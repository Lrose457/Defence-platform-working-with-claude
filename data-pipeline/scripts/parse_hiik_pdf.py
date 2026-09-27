#!/usr/bin/env python3
"""
Parse the HIIK Conflict Barometer PDF into a review-ready CSV of conflicts
with intensity levels (patch 0.2 doc: ingest HIIK conflict data).

Primary source: the regional "Overview" tables (Name of conflict | Conflict
parties | Conflict items | Start | Int.), which carry an explicit intensity
column (1-5). A prose fallback using verb-anchored intensity phrases
("remained a non-violent crisis", "escalated to a violent crisis") covers
conflicts missing from a table.

Output: data-pipeline/data/hiik_2025_conflicts.csv

IMPORTANT (licensing):
    HIIK data is NOT openly licensed. The CSV this script produces is a
    *working file* for your own review and entry creation, not something to
    bulk-publish. Each row must be human-verified, linked to a source record
    in the `sources` table (HIIK Conflict Barometer 2025), and ingested
    through the reviewed pipeline like any other source. Show attribution
    "HIIK Conflict Barometer 2025 (methodology: HIIK)" on conflict pages —
    see /data-licences. If you need bulk redistribution rights, contact
    HIIK directly (hiik.de).

Requirements:
    pip install pypdf fonttools
    (fontTools is required to decode the report's embedded Type1 fonts —
    without it the overview tables extract as garbled text.)

Usage:
    python3 data-pipeline/scripts/parse_hiik_pdf.py \
        --pdf "/Users/leorosenthal/Downloads/coba_2025.pdf" \
        --out data-pipeline/data/hiik_2025_conflicts.csv
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

from pypdf import PdfReader

# ---------------------------------------------------------------- constants

SECTION_HEADERS = [
    "EUROPE",
    "SUB-SAHARAN AFRICA",
    "THE AMERICAS",
    "ASIA AND OCEANIA",
    "WEST ASIA, NORTH AFRICA, AND AFGHANISTAN",
]

REGION_ALIASES = {
    "europe": "EUROPE",
    "sub-saharan africa": "SUB-SAHARAN AFRICA",
    "the americas": "THE AMERICAS",
    "asia and oceania": "ASIA AND OCEANIA",
    "west asia, north africa, and afghanistan": "WEST ASIA, NORTH AFRICA, AND AFGHANISTAN",
    "west asia, north africa and afghanistan": "WEST ASIA, NORTH AFRICA, AND AFGHANISTAN",
}

# Table rows are delimited by their trailing "<start-year> <intensity>"
# pair, followed by the next row's capitalised name (or lowercase 'e' for
# eSwatini). Splitting on this pair is far more reliable than trying to
# regex-match the free-text parties/items column.
ROW_SPLIT = re.compile(" (\\d{4}) ([1-5])(?= [A-ZÀ-Že]|$)")

# Column header repeated on every table page. Some chapter openers lose
# their title text in extraction (the 2025 WANA page yields just
# "Overview:  Conflicts"), so the header is the reliable table marker.
TABLE_HEADER = re.compile(
    "Name of conflict \\d? ?Conflict parties \\d? ?Conflict items Start Change \\d? ?Int\\.? ?\\d?"
)

HEADER_REMNANT = re.compile(
    "Overview:\\s*Conflicts(?: in .{5,90}? in 2025)?|" + TABLE_HEADER.pattern
)

# Running footer: region name + page number ("SUB-SAHARAN AFRICA 77").
FOOTER_REMNANT = re.compile(
    "(?:" + "|".join(re.escape(h) for h in SECTION_HEADERS) + ") \\d{1,3}"
)

OVERVIEW_TITLE = re.compile("Overview: Conflicts in (.+?) in 2025")

FOOTER_NAMES = {h for h in SECTION_HEADERS} | {h.split(",")[0] for h in SECTION_HEADERS}

# A hyphen glued to the preceding word but followed by whitespace is a
# line-break hyphen ("Myan-\nmar" → "Myan- mar"). Rejoin it when what
# follows is lowercase ("mar" → Myanmar) but keep genuine compounds whose
# second half is capitalised ("Guinea- Bissau" stays Guinea-Bissau).
LINEBREAK_HYPHEN = re.compile(r"([A-Za-z])- +([a-z])")


def fix_linebreak_hyphens(name: str) -> str:
    return LINEBREAK_HYPHEN.sub(r"\1\2", name)

# ---------------------------------------------------------------- helpers


def normalize(text: str, keep_lines: bool = False) -> str:
    """Normalise the PDF text layer.

    HIIK's fonts render dashes and some punctuation as private-use control
    characters (chr(0x15) appears as the hyphen in 'de-escalated' and as
    the separator in names like 'Russia - Ukraine'). Mapping them to ASCII
    and collapsing whitespace makes patterns match reliably without fragile
    backslash classes.
    """
    text = text.replace(chr(0x15), "-")
    text = re.sub("[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", " ", text)
    if keep_lines:
        text = re.sub("[ \t\f\v]+", " ", text)
        text = re.sub(" ?\n ?", "\n", text)
    else:
        text = re.sub("[ \t\n\r\f\v]+", " ", text)
    return text


def map_region(title: str) -> str | None:
    probe = title.strip().lower().rstrip(".")
    for alias, region in REGION_ALIASES.items():
        if probe.startswith(alias) or alias.startswith(probe):
            return region
    return None


def next_section(region: str | None) -> str | None:
    """Chapters run in SECTION_HEADERS order; return the one after `region`."""
    try:
        return SECTION_HEADERS[SECTION_HEADERS.index(region) + 1]
    except (ValueError, IndexError):
        return None


def parse_tables(reader: PdfReader) -> tuple[list[dict], list[str]]:
    """Extract rows from the regional overview tables.

    Returns (rows, unmatched_regions): rows carry name, region, parties,
    items, start_year, intensity_level, pdf_page.
    """
    # current: region currently being accumulated; chunks: (start_offset,
    # page_index, text) per region so row positions map back to pages.
    current: str | None = None
    last_table_region: str | None = None
    chunks: dict[str, list[tuple[int, int, str]]] = {}
    offsets: dict[str, int] = {}

    for idx, page in enumerate(reader.pages):
        text = normalize(page.extract_text() or "")
        if len(text) < 40:
            continue

        title = OVERVIEW_TITLE.search(text)
        region = map_region(title.group(1)) if title else None
        if region:
            current = region
            last_table_region = region
        elif TABLE_HEADER.search(text) and current is None and last_table_region:
            if "Overview: Conflicts" in text:
                # Chapter opener whose title text failed to decode: advance
                # to the next chapter in the fixed order (2025 WANA case).
                current = last_table_region = next_section(last_table_region)
            else:
                # Continuation after interleaved prose: resume the chapter.
                current = last_table_region

        if current is None:
            continue

        # Table pages carry the "vs." party separator early (or the column
        # header when a long name delays the first "vs."); prose pages
        # (regional analysis) do not.
        looks_like_table = bool(title) or TABLE_HEADER.search(text) or " vs. " in text[:600]
        if not looks_like_table:
            current = None
            continue

        # Strip the column header (repeat on every table page) and the
        # running footer (region name + page number) BEFORE joining pages.
        text = HEADER_REMNANT.sub(" ", text)
        text = FOOTER_REMNANT.sub(" ", text)
        text = re.sub(" +", " ", text).strip()

        chunks.setdefault(current, [])
        offsets.setdefault(current, 0)
        start = offsets[current]
        chunks[current].append((start, idx, text))
        offsets[current] = start + len(text) + 1

    rows: list[dict] = []
    for region, region_chunks in chunks.items():
        text = ""
        page_map: list[tuple[int, int]] = []
        for start, page_idx, body in region_chunks:
            page_map.append((start, page_idx))
            text += body + " "

        def page_for(pos: int) -> int:
            page_idx = 0
            for start, idx in page_map:
                if pos >= start:
                    page_idx = idx
            return page_idx + 1

        # Drop residual header text, then split into rows on the
        # "<year> <intensity> <Capital-or-e>" delimiter.
        text = HEADER_REMNANT.sub(" ", text)
        text = re.sub(" +", " ", text).strip()

        marks = list(ROW_SPLIT.finditer(text))
        for i, m in enumerate(marks):
            seg_start = (marks[i - 1].end() if i > 0 else 0)
            seg_end = m.start()
            segment = text[seg_start:seg_end].strip()
            if not segment:
                continue

            # Name = text up to the "*" footnote marker; parties/items
            # follow. Segments without "*" are only accepted when they
            # look like a clean standalone name (no party separator, no
            # embedded year) — otherwise they are page-boundary garbage.
            if "*" in segment:
                name, parties_items = segment.split("*", 1)
            else:
                if " vs. " in segment or ROW_SPLIT.search(segment[1:]):
                    continue
                if len(segment) > 90 or not re.fullmatch(
                    "[A-ZÀ-Že][A-Za-zÀ-ž'’ (),/\\-]+", segment
                ):
                    continue
                name, parties_items = segment, ""
            name = fix_linebreak_hyphens(name.strip(" .,;"))
            if not name or len(name) > 90 or not WORDish.search(name):
                continue

            rows.append(
                {
                    "conflict_name": name,
                    "region_section": region,
                    "parties_items": parties_items.strip()[:250],
                    "start_year": m.group(1),
                    "intensity_level": int(m.group(2)),
                    "pdf_page": page_for(seg_start),
                }
            )
    return rows, list(chunks.keys())


# ------------------------------------------------- prose fallback (robust)

VERB = (
    "(remained|remains|stayed|stays|persisted|persists|continues|continued|"
    "escalated|de-escalated|deescalated|erupted|classified)"
)

# crisis/crises have different stems: cris[ie]s covers both. Longer phrases
# claim their span first so "violent crisis" never matches inside
# "non-violent crisis" and bare "war" never beats "full war"/"limited war".
PHRASE_ALTS = [
    ("full wars?", 5),
    ("limited wars?", 4),
    ("non[- ]?violent cris[ie]s?", 2),
    ("violent cris[ie]s?", 3),
    ("disputes?", 1),
    ("wars?(?! crimes?| torn| head| zones?| games?| wear)", 5),
]

PHRASE_GROUP = "|".join("(?:" + p + ")" for p, _ in PHRASE_ALTS)

ANCHORED = re.compile(
    VERB + "[^.;]{0,80}?(" + PHRASE_GROUP + ")"
    "(?: (?:to|into) (?:an? )?(" + PHRASE_GROUP + "))?",
    re.IGNORECASE,
)

REF = re.compile(r"\[→\s*([^\]\[]{2,90})\]")
WORDish = re.compile(r"[A-Za-zÀ-ž]")


def phrase_to_level(phrase: str) -> int | None:
    lowered = phrase.lower().strip()
    for pattern, level in PHRASE_ALTS:
        if re.fullmatch(pattern, lowered):
            return level
    return None


def find_levels(text: str) -> list[tuple[int, str, int, bool]]:
    """Verb-anchored intensity classifications: (level, phrase, pos, is_target)."""
    results: list[tuple[int, str, int, bool]] = []
    for match in ANCHORED.finditer(text):
        phrase = match.group(2) or match.group(1)
        level = phrase_to_level(phrase)
        if level is not None:
            results.append((level, phrase, match.start(), bool(match.group(2))))
    return results


def classify_change(text: str) -> str:
    lowered = text.lower()
    if "de-escalat" in lowered or "deescalat" in lowered:
        return "de-escalated"
    if "escalated" in lowered or "erupted" in lowered:
        return "escalated"
    if "remained" in lowered or "continued" in lowered or "stayed" in lowered:
        return "stable"
    return "unclear"


def clean_name(raw: str) -> str:
    name = raw.strip().replace(chr(0x15), "-")
    name = re.sub(" +", " ", name)
    name = fix_linebreak_hyphens(name)
    if name.count("(") > 1:
        head = name.split(")", 1)[0]
        name = head + ")" if ")" in head else name
    return name.strip(" .;,")


def parse_prose(reader: PdfReader) -> list[dict]:
    """Fallback: bracket-ref prose parsing (conflicts missing from tables)."""
    rows: dict[tuple[str, str], dict] = {}
    # Regional chapters run in a fixed order, so once a page's footer names
    # a region we keep carrying it forward for pages whose own footer is
    # missing or non-standard (chapter openers, map pages, …).
    current_region: str | None = None

    for idx, page in enumerate(reader.pages):
        text = normalize(page.extract_text() or "")
        if len(text) < 50:
            continue

        page_reg = page_region(reader, idx)
        if page_reg:
            current_region = page_reg
        elif "regional development" in text[:400].lower():
            # Chapter openers announce their region in the first paragraph
            # but don't always carry a footer; without this the carry-forward
            # bleeds the previous chapter across the boundary.
            head = text[:400].lower()
            current_region = next(
                (reg for alias, reg in REGION_ALIASES.items() if alias in head),
                current_region,
            )

        for match in REF.finditer(text):
            raw_name = match.group(1)
            if not WORDish.search(raw_name) or ";" in raw_name:
                continue

            window_start = max(0, match.start() - 160)
            window = text[window_start: match.end() + 260]
            levels = find_levels(window)
            if not levels:
                continue

            bracket_pos = match.start() - window_start

            def distance(lv: tuple[int, str, int, bool]) -> tuple[int, int]:
                if lv[2] >= bracket_pos:
                    return (0, lv[2] - bracket_pos)
                return (1, bracket_pos - lv[2])

            level, phrase, _, is_transition = min(
                levels, key=lambda lv: (distance(lv), not lv[3])
            )

            name = clean_name(raw_name)
            # Region: the page's own footer, else the last region whose
            # footer we saw (chapters are contiguous), else UNKNOWN.
            region = page_reg or current_region or "UNKNOWN"
            key = (name, region)
            excerpt = re.sub(" +", " ", text[match.end(): match.end() + 200]).strip()[:200]
            change = classify_change(window)

            existing = rows.get(key)
            if existing is None:
                rows[key] = {
                    "conflict_name": name,
                    "region_section": region,
                    "parties_items": "",
                    "start_year": "",
                    "intensity_level": level,
                    "intensity_phrase": phrase.lower(),
                    "evidence_excerpt": excerpt,
                    "pdf_page": idx + 1,
                    "status_change": change,
                    "_transition": is_transition,
                }
            elif is_transition and not existing.get("_transition"):
                existing.update(
                    intensity_level=level,
                    intensity_phrase=phrase.lower(),
                    evidence_excerpt=excerpt,
                    pdf_page=idx + 1,
                    status_change=change,
                    _transition=True,
                )

    return list(rows.values())


def page_region(reader: PdfReader, idx: int) -> str | None:
    """Read a page's own running footer to identify its regional section."""
    lines = [
        l.strip()
        for l in normalize(reader.pages[idx].extract_text() or "", keep_lines=True).splitlines()
        if l.strip()
    ]
    for line in reversed(lines[-4:]):
        # Footers may carry the page number ("EUROPE 53") or a full stop.
        candidate = re.sub(r"[\s.]*\d{0,3}$", "", line).strip()
        if candidate in FOOTER_NAMES:
            return next(
                h for h in SECTION_HEADERS
                if h == candidate or h.split(",")[0] == candidate
            )
    return None


# ------------------------------------------------------------------- main


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", required=True, type=Path)
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("data-pipeline/data/hiik_2025_conflicts.csv"),
    )
    args = parser.parse_args()

    if not args.pdf.exists():
        print(f"PDF not found: {args.pdf}", file=sys.stderr)
        return 1

    reader = PdfReader(str(args.pdf))

    table_rows, regions_found = parse_tables(reader)
    prose_rows = parse_prose(reader)

    # Table rows are authoritative; prose rows only fill gaps (name not
    # already covered for that region, case/space-insensitive).
    def key(name: str, region: str) -> tuple[str, str]:
        return (re.sub("[^a-z0-9]", "", name.lower()), region)

    merged: dict[tuple[str, str], dict] = {}
    for row in table_rows:
        merged[key(row["conflict_name"], row["region_section"])] = {
            "conflict_name": row["conflict_name"],
            "region_section": row["region_section"],
            "intensity_level": row["intensity_level"],
            "intensity_phrase": "overview table",
            "evidence_excerpt": f"Parties/items: {row['parties_items']}",
            "start_year": row["start_year"],
            "pdf_page": row["pdf_page"],
            "status_change": "review",
        }

    prose_added = 0
    table_names = {
        re.sub("[^a-z0-9]", "", name.lower()) for name in
        (row["conflict_name"] for row in table_rows)
    }
    for row in prose_rows:
        k = key(row["conflict_name"], row["region_section"])
        if k in merged:
            continue
        # Global-panorama prose (pages 19-22) references conflicts from every
        # region with no footer to anchor them; the table row wins.
        if row["region_section"] == "UNKNOWN" and re.sub("[^a-z0-9]", "", row["conflict_name"].lower()) in table_names:
            continue
        merged[k] = {
            "conflict_name": row["conflict_name"],
            "region_section": row["region_section"],
            "intensity_level": row["intensity_level"],
            "intensity_phrase": row["intensity_phrase"],
            "evidence_excerpt": row["evidence_excerpt"],
            "start_year": "",
            "pdf_page": row["pdf_page"],
            "status_change": row["status_change"],
        }
        prose_added += 1

    rows_out = sorted(
        merged.values(),
        key=lambda r: (str(r["region_section"]), str(r["conflict_name"])),
    )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=[
                "conflict_name",
                "region_section",
                "intensity_level",
                "intensity_phrase",
                "evidence_excerpt",
                "start_year",
                "pdf_page",
                "status_change",
            ],
            extrasaction="ignore",
        )
        writer.writeheader()
        writer.writerows(rows_out)

    by_level: dict[int, int] = {}
    by_region: dict[str, int] = {}
    for row in rows_out:
        level = int(row["intensity_level"])  # type: ignore[arg-type]
        by_level[level] = by_level.get(level, 0) + 1
        region = str(row["region_section"])
        by_region[region] = by_region.get(region, 0) + 1

    labels = {1: "Dispute", 2: "Non-violent crisis", 3: "Violent crisis",
              4: "Limited war", 5: "War"}
    print(f"Wrote {len(rows_out)} conflicts → {args.out}")
    print(f"  (overview-table rows: {len(rows_out) - prose_added}, prose fallback: {prose_added})")
    for level in sorted(by_level):
        print(f"  L{level} {labels[level]}: {by_level[level]}")
    print("  By region:")
    for region in sorted(by_region):
        print(f"    {region}: {by_region[region]}")
    print()
    print("NEXT STEPS (manual, licence-safe):")
    print("  1. Review the CSV — name cleanup and intensity confirmation.")
    print("  2. Ensure a 'sources' record exists for HIIK Conflict Barometer 2025.")
    print("  3. Create/update `conflicts` rows (name, region, status,")
    print("     intensity_level, data_confidence='Medium') and link parties.")
    print("  4. Attribute 'HIIK Conflict Barometer 2025' on the Conflict Tracker;")
    print("     bulk republication needs HIIK's permission (see /data-licences).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
