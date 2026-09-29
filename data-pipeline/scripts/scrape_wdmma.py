#!/usr/bin/env python3
"""Scrape WDMMA air-service inventory pages into a provenance-stamped payload.

Source
------
World Directory of Modern Military Aircraft (https://www.wdmma.org/). A
community-maintained enthusiast directory that publishes per-country,
per-air-service aircraft inventories with category breakdowns, on-order
figures, a TruVal strength rating, and a global rank.

What the site actually serves
-----------------------------
The site is server-rendered PHP but the inventory is **not** a table. Each air
service page renders one "plate" per aircraft type:

    <div class="acPlateContainer zoom picTrans"
         onClick="on('Lockheed F-35 Lightning II','<description>','/aircraft/imgs/med/....jpg')">
      <div class="acFlag"><img class="acFlag" src="/imgs/flags/midblock/united-states.jpg"></div>
      <div class="circle"><span class="textJumbo textBold textDkGray">33</span><br>
        <span class="textNormal textBold textLtrGray">Units</span></div>
      <div class="acDetails">
        <span class="textBold textNormal textDkGray">F-35B</span><br>
        <span class="textNormal textDkGray textItalics">Strike</span>
      </div>
    </div>

Each section is preceded by an `<h3>` heading such as "Fighters (Making up
approximately 27% of Total Strength)" and begins with a summary "TOTAL"
plate. The final section is "On Order / Future Procurement", which uses the
identical plate markup -- so the section heading, not the markup, is what
distinguishes in-service holdings from future procurement.

Two parsing traps this module exists to handle:

1. **Readiness and ranking numbers are not inventory.** Before the first `<h3>`
   the page carries a `rankBoxes` block (Force Concentration, TruVal Rating,
   Global Rank) that reuses the same `textJumbo` span classes as the plates.
   Naively scraping every `textJumbo` on the page yields a "55.3" aircraft
   count. Every plate parse here is scoped to a single `<h3>` section for that
   reason.
2. **The `onClick` description contains commas.** Splitting the argument list on
   commas silently truncates descriptions. The regex anchors the image path
   (always the final argument, always site-relative with a `/`) and lets the
   description match greedily, so an embedded comma cannot break the parse.

Copyright
---------
WDMMA states its written content and imagery are copyrighted and not for
reuse/republication. This scraper therefore stores only the *facts* -- unit
counts, designations, roles, section shares, flags and image **paths** -- and
deliberately discards the per-aircraft descriptive blurbs (see
`parse_plate`). Image paths are recorded as references for an analyst to
resolve; the images themselves are not downloaded or redistributed.

It does not bypass paywalls, logins, API keys, or robots rules. WDMMA's
robots.txt sets no `Disallow` directives. Requests are rate limited, carry an
identifying User-Agent, and are cached on disk so re-runs do not re-hit the
site.
"""

from __future__ import annotations

import argparse
import bisect
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

BASE_URL = "https://www.wdmma.org"
INDEX_URL = f"{BASE_URL}/"

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DEFAULT_OUTPUT = DATA_DIR / "wdmma_aircraft_inventory.json"
CACHE_DIR = DATA_DIR / "wdmma_cache"

TIMEOUT = 60
SOURCE_REGISTRY_ID = "wdmma"
SOURCE_PUBLISHER = "WDMMA.org (World Directory of Modern Military Aircraft)"
SOURCE_TITLE = "WDMMA Current Aircraft Inventory"
SOURCE_NOTE = (
    "Community-maintained enthusiast directory, not an official inventory. "
    "WDMMA states its written content and imagery are copyrighted and not for "
    "reuse/republication, so this scraper stores factual counts, designations, "
    "roles and image paths only and discards the published descriptive text."
)
RELIABILITY = "Community-maintained"
USER_AGENT = (
    "defence-intel-platform-research-scraper/1.0 "
    "(aircraft inventory ingestion; contact: platform maintainer)"
)

# Pages on the site that are chrome rather than air services. Excluded so they
# never enter the service index.
NON_SERVICE_SLUGS = {
    "ranking",
    "cookies",
    "disclaimer",
    "privacy-policy",
    "site-disclaimer",
}

# Section heading for future procurement, matched case-insensitively.
ON_ORDER_HEADING = "on order"



# --- Index page -------------------------------------------------------------
# Country block: <div class="encompassingContainer"> ... <span class="textWhite">Russia</span>
# <span class="textYellow">(4,061)</span> ... <a class="picTrans" href="/slug.php">Name (count)
#
# Each country is a collapsible block introduced by an uppercase HTML comment
# (`<!--AFGHANISTAN-->`, `<!--UNITED-STATES-->`, ...) and terminated by the next
# one. Splitting on the comment markers -- not on `encompassingContainer`, which
# never closes cleanly -- is what keeps one country from inheriting the next
# country's name. There are 101 such blocks covering 130 air services.
#
# The terminator is a lookahead so the group captures only the block body.
COUNTRY_BLOCK_RE = re.compile(
    r'<!--[A-Z]{3,}-->\s*<div class="encompassingContainer">(.*?)'
    r"(?=<!--[A-Z]{3,}-->|\Z)",
    re.S,
)
COUNTRY_NAME_RE = re.compile(r'<span class="textWhite">\s*([^<]+?)\s*</span>')
COUNTRY_TOTAL_RE = re.compile(r'<span class="textYellow">\s*\(([\d,]+)\)')
SERVICE_LINK_RE = re.compile(
    r'<a class="picTrans" href="/(?P<slug>[a-z0-9\-]+)\.php"[^>]*>(?P<body>.*?)</a>', re.S
)
SERVICE_NAME_RE = re.compile(r'<span class="textDkGray">\s*([^<]+?)\s*</span>')
SERVICE_COUNT_RE = re.compile(r'<span class="textGreen">\s*\(([\d,]+)\)')

# --- Air service page -------------------------------------------------------
H1_RE = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S)
# "Current Active Inventory: 513 Aircraft"
#
# Some pages wrap the count in a span instead of emitting it as bare text
# (e.g. Nagorno-Karabakh: `Current Active Inventory:
# <span class='textYellowOrange'>12 Aircraft</span>`). Allowing a run of tags
# between the label and the digits covers both layouts.
ACTIVE_TOTAL_RE = re.compile(
    r"Current Active Inventory:(?:<[^>]*>|\s)*([\d,]+)\s*Aircraft"
)
# Section headings come in two colours. The modern template renders every
# inventory section dark-on-light (textDkGray). The legacy template renders
# active sections dark but its "On Order" section white-on-dark, because that
# strip has a dark background:
#
#   <h3 class="textLargest textDkGray">Fighters (41)</h3>   <- legacy active
#   <h3 class="textLargest textWhite">On Order (65)</h3>    <- legacy on order
#
# Matching only textDkGray leaves the legacy On Order heading unrecognised, so
# its aircraft are attributed to the preceding active section and counted as
# already-fielded. Across the corpus that inflates 32 services and makes their
# holdings sum to more than the page's own published total.
#
# Both colours are matched, and NON_INVENTORY_SECTIONS filters the two heading
# kinds that are site furniture rather than inventory.
H3_RE = re.compile(
    r'<h3 class="textLargest text(?:DkGray|White)">\s*(.*?)\s*</h3>', re.S
)
NON_INVENTORY_SECTIONS = ("suppliers", "related services")
SECTION_SHARE_RE = re.compile(r"Making up approximately\s*([\d.]+)%")
TRUVAL_RE = re.compile(r"textJumbo textBold\">\s*([\d.]+)\s*</span>")
GLOBAL_RANK_RE = re.compile(
    r'textJumbo textBold">\s*<span class="textDkGray">\s*(\d+)\s*</span>'
)
RANK_TOTAL_RE = re.compile(r'textLtrGray">\s*/\s*(\d+)')
UPDATED_RE = re.compile(r"Updated:\s*([0-9/]{8,10})")

# A plate begins at its opening div. Capturing the name and image path from the
# onClick payload: the description is matched but discarded.
#
#   onClick="on('NAME','DESCRIPTION, WITH COMMAS','/img/path.jpg')"
#
# The description is matched with `[^'"]*` rather than `.*`. Greedy `.*` under
# re.S runs straight past the closing `')">` and swallows the *next* plate's
# onClick, which silently pairs each aircraft with the following aircraft's
# image. Excluding the quote character confines the match to this one
# attribute, so embedded commas are tolerated but attribute boundaries are not
# crossed. The image path is anchored to the final argument.
PLATE_RE = re.compile(
    r'<div class="acPlateContainer zoom picTrans"\s*onClick="on\(\'(?P<name>[^\']*)\','
    r"'(?P<description>[^'\"]*)','(?P<image>/[^']*)'\)\">"
    r'(?P<body>.*?)(?=<div class="acPlateContainer|<h3 |</body>)',
    re.S,
)
PLATE_UNITS_RE = re.compile(
    r'<div class="circle">\s*<span class="textJumbo textBold textDkGray">\s*([\d,]+)\s*</span>'
)
PLATE_DETAILS_RE = re.compile(r'<div class="acDetails">(.*?)</div>', re.S)
PLATE_DESIGNATION_RE = re.compile(
    r'<span class="textBold textNormal textDkGray">\s*([^<]+?)\s*</span>'
)
PLATE_ROLE_RE = re.compile(
    r'<span class="textNormal textDkGray textItalics">\s*([^<]+?)\s*</span>'
)
PLATE_FLAG_RE = re.compile(r'<img class="acFlag" src="/imgs/flags/midblock/([^"]+)\.jpg"')

# Summary "TOTAL" plate that opens each section, used for reconciliation.
SECTION_TOTAL_RE = re.compile(
    r'<div class="acPlateContainer"[^>]*>\s*<div class="circle">\s*'
    r'<span class="textJumbo textBold textWhite">\s*([\d,]+)\s*</span>'
)

# --- Legacy template --------------------------------------------------------
# 41 of the 130 air services (mostly navy aviation and smaller air forces) are
# still served from WDMMA's older page template. It renders the same data with
# different element and class names, and crucially uses a lowercase `onclick`
# with no `zoom picTrans` classes, so PLATE_RE never matches it. Without these
# patterns those services parse to zero aircraft -- a silent data loss, because
# each of them still publishes a correct headline total.
#
#   <div class="acPanelFormatting" onclick="on('Dassault Rafale','<desc>','/img.jpg')">
#     <div class="numContainer"><span class="...">41</span></div>
#     <div class="flagMinContainer"><img class="flagMinStyling" src="/imgs/flags/midblock/france.jpg"></div>
#     <div class="nameContainer"><span class="textWhite textNormal">Rafael M</span></div>
#     <div class="nameContainer"><span class="textSmall2 textWhite">Multirole</span></div>
#   </div>
# The `onclick` casing is not consistent even within the legacy template:
# Italian Army Aviation uses lowercase `onclick` while Royal Bahraini Air Force
# uses `onClick`. Matching the attribute case-insensitively is what lets one
# pattern cover all 41 legacy pages.
#
# The closing anchor is `')">` on most pages but `')" style="...">` on others
# (Spanish Army Aviation, Iranian Navy Aviation, Royal Navy Fleet Air Arm).
# Anchoring on the exact tag end silently drops those pages, so the terminator
# accepts any further attributes before the closing `>`.
LEGACY_PLATE_RE = re.compile(
    r'<div class="acPanelFormatting"\s+onclick="on\(\'(?P<name>[^\']*)\','
    r"'(?P<description>[^'\"]*)','(?P<image>/[^']*)'\)[^>]*>"
    r'(?P<body>.*?)(?=<div class="acPanelFormatting|<h3 |</body>)',
    re.S | re.I,
)
LEGACY_UNITS_RE = re.compile(
    r'<div class="numContainer"><span[^>]*>\s*([\d,]+)\s*</span>'
)
LEGACY_DESIGNATION_RE = re.compile(
    r'<div class="nameContainer">\s*<span class="textWhite textNormal">\s*([^<]+?)\s*</span>',
    re.S,
)
# The role sits in a second nameContainer. Scoped to the panel body so the
# adjacent OUTLOOK panel's "POSITIVE" badge is never mistaken for a role.
LEGACY_ROLE_RE = re.compile(
    r'<span class="textSmall2 textWhite">\s*([^<]+?)\s*</span>'
)
LEGACY_FLAG_RE = re.compile(
    r'<img class="flagMinStyling" src="/imgs/flags/midblock/([^"]+)\.jpg"'
)

# Legacy section headings carry the section total in brackets -- "Fighters (41)"
# -- where the modern template writes "Making up approximately 27% of Total
# Strength". The modern heading ends in ")" but its parenthesised text is never
# a bare number, so anchoring on digits keeps the two templates apart.
SECTION_COUNT_RE = re.compile(r"\(([\d,]+)\)\s*$")


UNITS_NOTE = (
    "Airframe counts as published by WDMMA. WDMMA does not track unmanned "
    "aerial vehicles, so totals exclude UAV holdings."
)


def retrieved_at() -> str:
    return datetime.now(timezone.utc).isoformat()


def to_int(value: str) -> int:
    """WDMMA formats counts with thousands separators, e.g. '13,052'."""
    return int(value.replace(",", ""))


def slug_for(slug: str) -> str:
    return slug.strip().lower().replace(" ", "-")


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en",
        }
    )
    return session


def fetch(
    session: requests.Session,
    url: str,
    cache: Path | None = None,
    delay: float = 1.0,
) -> str:
    """GET `url` with backoff, optionally served from an on-disk cache.

    Caching matters for a politeness point as much as a speed one: re-running
    the scraper after a parser change should not re-request 130 pages.
    """
    if cache and cache.exists():
        return cache.read_text(encoding="utf-8")

    last_error: Exception | None = None
    for attempt in range(4):
        try:
            response = session.get(url, timeout=TIMEOUT)
            if response.status_code in (429, 500, 502, 503, 504):
                time.sleep(delay * (2**attempt))
                continue
            response.raise_for_status()
            html = response.text
            if cache:
                cache.parent.mkdir(parents=True, exist_ok=True)
                cache.write_text(html, encoding="utf-8")
            time.sleep(delay)
            return html
        except requests.RequestException as error:
            last_error = error
            time.sleep(delay * (2**attempt))
    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


def parse_index(html: str) -> list[dict[str, Any]]:
    """Extract every air service and its country from the WDMMA index page.

    The index is a collapsible list: one block per country holding one link
    per air service (e.g. the United States has Air Force, Army, Marine Corps
    and Navy). The per-service count published here matches the service page,
    so it doubles as a cross-check.
    """
    services: list[dict[str, Any]] = []
    for block in COUNTRY_BLOCK_RE.findall(html):
        country_match = COUNTRY_NAME_RE.search(block)
        if not country_match:
            continue
        country = country_match.group(1)
        total_match = COUNTRY_TOTAL_RE.search(block)
        country_total = to_int(total_match.group(1)) if total_match else None

        for link in SERVICE_LINK_RE.finditer(block):
            slug = link.group("slug")
            if slug in NON_SERVICE_SLUGS:
                continue
            body = link.group("body")
            name_match = SERVICE_NAME_RE.search(body)
            if not name_match:
                continue
            count_match = SERVICE_COUNT_RE.search(body)
            services.append(
                {
                    "air_service": name_match.group(1),
                    "air_service_slug": slug,
                    "country": country,
                    "index_count": to_int(count_match.group(1)) if count_match else None,
                    "country_total": country_total,
                    "url": f"{BASE_URL}/{slug}.php",
                }
            )
    return services


# The two page templates differ only in element/class naming, so parsing is
# driven by a template object rather than duplicated per template.
MODERN_TEMPLATE = {
    "plate": PLATE_RE,
    "units": PLATE_UNITS_RE,
    "designation": PLATE_DESIGNATION_RE,
    "role": PLATE_ROLE_RE,
    "flag": PLATE_FLAG_RE,
    "details": PLATE_DETAILS_RE,
}
LEGACY_TEMPLATE = {
    "plate": LEGACY_PLATE_RE,
    "units": LEGACY_UNITS_RE,
    "designation": LEGACY_DESIGNATION_RE,
    "role": LEGACY_ROLE_RE,
    "flag": LEGACY_FLAG_RE,
    "details": None,
}


def detect_template(html: str) -> dict[str, Any]:
    """Pick the page template by probing for a signature unique to each.

    Falls back to the modern template so an unrecognised page still gets a
    parse attempt and surfaces as a reconciliation warning rather than as
    silently missing rows.
    """
    if "acPanelFormatting" in html and "acPlateContainer" not in html:
        return LEGACY_TEMPLATE
    return MODERN_TEMPLATE


def parse_plate(match: re.Match[str], service: dict[str, Any],
                category: str, on_order: bool,
                share_pct: float | None,
                template: dict[str, Any] | None = None) -> dict[str, Any]:
    """Turn one matched plate into a normalised inventory record.

    The `description` group is intentionally never read. WDMMA's terms do not
    permit republishing its written content, and the counts, designations and
    roles below are what the platform needs for inventory analysis.
    """
    template = template or MODERN_TEMPLATE
    body = match.group("body")
    units_match = template["units"].search(body)
    flag_match = template["flag"].search(body)

    # The modern template hides designation and role in an acDetails div; the
    # legacy template carries them inline in the panel body.
    if template["details"] is not None:
        details_match = template["details"].search(body)
        scope = details_match.group(1) if details_match else ""
    else:
        scope = body

    designation_match = template["designation"].search(scope)
    role_match = template["role"].search(scope)

    designation = designation_match.group(1) if designation_match else match.group("name")

    # Designations can repeat inside one service when a type is split across
    # variants ("F-35B" under both Fighters and Naval Aviation). The key
    # includes the section so re-running stays idempotent.
    return {
        "external_id": (
            f"wdmma:{service['air_service_slug']}:"
            f"{'on-order' if on_order else 'active'}:{category}:{designation}"
        ),
        "country": service["country"],
        "air_service": service["air_service"],
        "air_service_slug": service["air_service_slug"],
        "category": category,
        "category_share_pct": share_pct,
        "designation": designation,
        "full_name": match.group("name"),
        "role": role_match.group(1) if role_match else None,
        "units": to_int(units_match.group(1)) if units_match else None,
        "on_order": on_order,
        "operator_flag": flag_match.group(1) if flag_match else None,
        "image_path": match.group("image"),
        "source_registry_id": SOURCE_REGISTRY_ID,
        "source_url": service["url"],
        "retrieved_at": service["retrieved_at"],
        "unit_note": UNITS_NOTE,
    }


def parse_service_page(html: str, service: dict[str, Any]) -> dict[str, Any]:
    """Parse one air service page into holdings plus its own summary metrics.

    Returns the record list under `"records"`, a service-level summary under
    `"summary"`, and any reconciliation problems under `"warnings"`.
    """
    warnings: list[str] = []
    records: list[dict[str, Any]] = []

    heading_match = H1_RE.search(html)
    page_title = heading_match.group(1).strip() if heading_match else None

    total_match = ACTIVE_TOTAL_RE.search(html)
    page_total = to_int(total_match.group(1)) if total_match else None

    truval_match = TRUVAL_RE.search(html)
    rank_match = GLOBAL_RANK_RE.search(html)
    rank_total_match = RANK_TOTAL_RE.search(html)
    updated_match = UPDATED_RE.search(html)

    # Plates are matched against the *whole* document and then attributed to a
    # section by offset. Slicing the HTML per section instead would break the
    # plate regex, whose body lookahead terminates on the *next* `<h3>`: inside
    # a slice there is no following heading, so the final plate in every section
    # would fail to match and its aircraft would vanish from the totals.
    #
    # Only plates positioned after a heading are kept. Everything before the
    # first <h3> is the rankBoxes block (TruVal, global rank, force
    # concentration), which reuses the plate span classes and would otherwise be
    # counted as aircraft.
    template = detect_template(html)
    headings = [(m.start(), m.group(1).strip()) for m in H3_RE.finditer(html)]
    starts = [start for start, _ in headings]
    section_meta: dict[int, tuple[str, bool, float | None, int | None]] = {}
    for start, raw_heading in headings:
        share_match = SECTION_SHARE_RE.search(raw_heading)
        share_pct = float(share_match.group(1)) if share_match else None
        category = SECTION_SHARE_RE.sub("", raw_heading)
        category = re.sub(r"\s*\(.*?\)\s*$", "", category).strip() or raw_heading
        # Legacy headings publish the section total as a bare "(41)" suffix;
        # the modern ones carry it on a separate TOTAL plate instead.
        count_match = SECTION_COUNT_RE.search(category)
        section_total = to_int(count_match.group(1)) if count_match else None
        if count_match:
            category = category[: count_match.start()].strip()
        section_meta[start] = (
            category,
            category.lower().startswith(ON_ORDER_HEADING),
            share_pct,
            section_total,
        )

    for plate in template["plate"].finditer(html):
        section_index = bisect.bisect_right(starts, plate.start()) - 1
        if section_index < 0:
            continue
        category, on_order, share_pct, _ = section_meta[starts[section_index]]
        if any(category.lower().startswith(skip) for skip in NON_INVENTORY_SECTIONS):
            continue
        record = parse_plate(
            plate, service, category, on_order, share_pct, template
        )
        if record["units"] is not None:
            records.append(record)

    # Each section publishes its own total -- a summary TOTAL plate on the
    # modern template, a bracketed count in the heading on the legacy one.
    # Comparing it against the sum of that section's plates localises a misparse
    # to a single category instead of leaving one aggregate discrepancy.
    for start, _raw_heading in headings:
        category, on_order, _, heading_total = section_meta[start]
        if any(category.lower().startswith(skip) for skip in NON_INVENTORY_SECTIONS):
            continue
        following = [s for s in starts if s > start]
        end = following[0] if following else len(html)
        section_total = heading_total
        if section_total is None:
            section_total_match = SECTION_TOTAL_RE.search(html[start:end])
            if not section_total_match:
                continue
            section_total = to_int(section_total_match.group(1))
        section_sum = sum(
            r["units"] or 0
            for r in records
            if r["category"] == category and r["on_order"] == on_order
        )
        if section_sum != section_total:
            warnings.append(
                f"{category}: plates sum to {section_sum:,} but the section "
                f"TOTAL plate reads {section_total:,}"
            )

    active_units = sum(r["units"] or 0 for r in records if not r["on_order"])
    on_order_units = sum(r["units"] or 0 for r in records if r["on_order"])

    # Self-validation. WDMMA prints its own totals, so a parse that silently
    # drops plates is detectable rather than quietly wrong.
    if page_total is not None and active_units != page_total:
        warnings.append(
            f"active holdings sum to {active_units:,} but the page reports "
            f"{page_total:,} active aircraft"
        )
    if service.get("index_count") is not None and page_total is not None:
        if service["index_count"] != page_total:
            warnings.append(
                f"index lists {service['index_count']:,} but the page reports "
                f"{page_total:,} (site updated between requests)"
            )

    summary = {
        "air_service": service["air_service"],
        "air_service_slug": service["air_service_slug"],
        "country": service["country"],
        "page_title": page_title,
        "active_total": page_total,
        "on_order_total": on_order_units or None,
        "index_count": service.get("index_count"),
        "country_total": service.get("country_total"),
        "global_rank": to_int(rank_match.group(1)) if rank_match else None,
        "ranked_against": to_int(rank_total_match.group(1)) if rank_total_match else None,
        "truv_val_rating": float(truval_match.group(1)) if truval_match else None,
        "types_tracked": len({r["designation"] for r in records}),
        "updated": updated_match.group(1) if updated_match else None,
    }

    return {"summary": summary, "records": records, "warnings": warnings}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--slug",
        action="append",
        default=[],
        help="Air service slug to scrape, repeatable (e.g. --slug russian-air-force)",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=0,
        help="Cap the number of service pages fetched (0 = all)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Seconds to wait between requests (default 1.0)",
    )
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Ignore and do not write the on-disk HTML cache",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    session = make_session()
    use_cache = None if args.no_cache else CACHE_DIR

    index_html = fetch(session, INDEX_URL, (use_cache / "index.html") if use_cache else None,
                       args.delay)
    services = parse_index(index_html)
    if not services:
        raise SystemExit(
            "No air services found on the index page. WDMMA's markup has "
            "probably changed; update the regexes in this script."
        )
    print(f"Index: {len(services)} air services across "
          f"{len({s['country'] for s in services})} countries")

    if args.slug:
        wanted = {slug_for(s) for s in args.slug}
        services = [s for s in services if s["air_service_slug"] in wanted]
        missing = wanted - {s["air_service_slug"] for s in services}
        if missing:
            raise SystemExit(f"Unknown slug(s): {', '.join(sorted(missing))}")
        print(f"Filtered to {len(services)} requested air services")

    if args.max_pages and args.max_pages < len(services):
        services = services[: args.max_pages]
        print(f"Capped at {len(services)} pages (--max-pages)")

    stamp = retrieved_at()
    all_records: list[dict[str, Any]] = []
    summaries: list[dict[str, Any]] = []
    all_warnings: list[str] = []

    for service in services:
        cache_path = (use_cache / f"{service['air_service_slug']}.html") if use_cache else None
        try:
            html = fetch(session, service["url"], cache_path, args.delay)
        except RuntimeError as error:
            all_warnings.append(f"{service['air_service_slug']}: {error}")
            print(f"  ! {service['air_service_slug']}: {error}")
            continue

        service["retrieved_at"] = stamp
        try:
            parsed = parse_service_page(html, service)
        except (re.error, TypeError, ValueError) as error:
            # One unexpected page layout must not abort a 130-page run. The
            # failure is recorded in the payload so it is visible on review
            # rather than lost with the traceback.
            all_warnings.append(
                f"{service['air_service_slug']}: parse failed ({error})"
            )
            print(f"  ! {service['air_service_slug']}: parse failed ({error})")
            continue
        all_records.extend(parsed["records"])
        summaries.append(parsed["summary"])
        for warning in parsed["warnings"]:
            all_warnings.append(f"{service['air_service_slug']}: {warning}")

        summary = parsed["summary"]
        flag = "" if not parsed["warnings"] else "  (see warnings)"

        # `active_total` is published text and is absent on some pages, so it
        # may legitimately be None. Falling back to the parsed sum keeps the
        # progress line informative instead of raising on a None format.
        active = summary["active_total"]
        if active is None:
            active = sum(r["units"] or 0 for r in parsed["records"] if not r["on_order"])
            flag = "  (no headline total)" + flag
        print(
            f"  {service['air_service']}: {active:,} active, "
            f"{len(parsed['records'])} types, rank "
            f"{summary['global_rank']}/{summary['ranked_against']}{flag}"
        )

    active_total = sum(r["units"] or 0 for r in all_records if not r["on_order"])
    on_order_total = sum(r["units"] or 0 for r in all_records if r["on_order"])

    document = {
        "source_registry_id": SOURCE_REGISTRY_ID,
        "publisher": SOURCE_PUBLISHER,
        "source_title": SOURCE_TITLE,
        "source_url": BASE_URL + "/",
        "reliability": RELIABILITY,
        "notes": SOURCE_NOTE,
        "target_table": "country_equipment",
        "units": UNITS_NOTE,
        "copyright": (
            "Only factual fields are stored. WDMMA's per-aircraft descriptive "
            "text is intentionally excluded and its images are referenced by "
            "path only; neither is downloaded or redistributed."
        ),
        "retrieved_at": stamp,
        "services_scraped": len(summaries),
        "record_count": len(all_records),
        "active_total": active_total,
        "on_order_total": on_order_total,
        "summaries": summaries,
        "records": all_records,
        "warnings": all_warnings,
    }

    if args.dry_run:
        print("\n--dry-run: nothing written.")
        print(f"Records: {len(all_records):,}  Active: {active_total:,}  "
              f"On order: {on_order_total:,}")
        if all_warnings:
            print(f"Warnings: {len(all_warnings)}")
        print("\nSample record:")
        print(json.dumps(all_records[0] if all_records else {}, indent=2))
        return

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(document, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    print(f"\nWrote {len(all_records):,} holdings to {args.output}")
    print(f"Active airframes: {active_total:,}  On order: {on_order_total:,}")
    if all_warnings:
        print(f"Warnings: {len(all_warnings)} (recorded in the payload)")
    print(
        "Queued, not loaded: this payload is replayed through the ingestion "
        "API by an authenticated admin session."
    )


if __name__ == "__main__":
    main()
