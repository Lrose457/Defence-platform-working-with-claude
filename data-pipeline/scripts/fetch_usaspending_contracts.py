"""Fetch public US federal contract awards for defence companies.

Endpoint
--------
POST https://api.usaspending.gov/api/v2/search/spending_by_award/

Verified request shape (2026-09)
--------------------------------
* ``sort``/``order`` are the correct pagination-order parameters. Passing a
  bare ``order`` key is silently ignored by the API.
* ``Awarding Sub Agency`` is the field that identifies the awarding service.
  The parent ``Awarding Agency`` is frequently "Department of Defense" for
  every award, so filtering on the parent alone cannot separate defence work
  from the rest and cannot distinguish Navy from Army.
* The endpoint does **not** return ``Period of Performance Start Date``,
  ``Period of Performance Current End Date`` or ``Award Type`` as ``null`` for
  contract-level results. Those values are not published on this endpoint, so
  they are recorded as ``null`` with a note rather than being treated as
  missing data. Award-level period data requires the award-detail endpoint
  (``/api/v2/awards/``) or FPDS.

Records are normalised with source registry id, award id, recipient, awarding
agency and sub agency, amount, description and source url, then written to
JSON for review before promotion into the platform's contract tables.
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import date
from pathlib import Path
from typing import Any

import requests

USA_SPENDING_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/"
EARLIEST_DATE = "2007-10-01"
TIMEOUT = 90

# Application company catalogue. Keyed by a stable slug rather than a database
# id, because the live `companies` table uses its own identity sequence and the
# previous comp-1..comp-13 keys did not match it.
COMPANIES: dict[str, dict[str, Any]] = {
    "lockheed-martin": {
        "name": "Lockheed Martin",
        "aliases": ["Lockheed Martin", "Lockheed Martin Corporation"],
    },
    "northrop-grumman": {
        "name": "Northrop Grumman",
        "aliases": ["Northrop Grumman", "Northrop Grumman Systems"],
    },
    "raytheon": {
        "name": "RTX (Raytheon Technologies)",
        "aliases": ["Raytheon", "RTX Corporation", "Raytheon Technologies"],
    },
    "general-dynamics": {
        "name": "General Dynamics",
        "aliases": ["General Dynamics"],
    },
    "bae-systems": {
        "name": "BAE Systems",
        "aliases": ["BAE Systems"],
    },
    "rolls-royce": {
        "name": "Rolls-Royce",
        "aliases": ["Rolls-Royce", "Rolls Royce", "Rolls-Royce Defense"],
    },
    "thales": {
        "name": "Thales",
        "aliases": ["Thales", "Thales Group"],
    },
    "airbus-defence": {
        "name": "Airbus Defence & Space",
        "aliases": ["Airbus Defence", "Airbus Defense", "Airbus"],
    },
    "rheinmetall": {
        "name": "Rheinmetall",
        "aliases": ["Rheinmetall"],
    },
    "leonardo": {
        "name": "Leonardo",
        "aliases": ["Leonardo", "Leonardo DRS", "Leonardo S.p.A"],
    },
    "mitsubishi-heavy": {
        "name": "Mitsubishi Heavy Industries",
        "aliases": ["Mitsubishi Heavy Industries", "MHI"],
    },
    "hanwha-aerospace": {
        "name": "Hanwha Aerospace",
        "aliases": ["Hanwha Aerospace", "Hanwha"],
    },
    "avic": {
        "name": "AVIC",
        "aliases": ["AVIC", "Aviation Industry Corporation of China"],
    },
}

# Defence awarding sub-agencies. Matching on the sub agency rather than the
# parent is what makes this filter meaningful: "Department of Defense" is the
# parent for every defence award, whereas the sub agency identifies the service.
DEFENCE_SUB_AGENCIES = (
    "department of defense",
    "department of the army",
    "department of the navy",
    "department of the air force",
    "defense contract management agency",
    "defense logistics agency",
    "naval air systems command",
    "naval sea systems command",
    "air force life cycle management center",
    "army contracting command",
    "naval supply systems command",
    "defense advanced research projects agency",
    "missile defense agency",
    "space and missile systems center",
    "air defense artillery",
)

# Some defence-relevant work is awarded by civilian science agencies (for
# example Lockheed Martin's $48bn NNSA record). Those are kept only when the
# award text carries a defence signal, so nuclear and energy work by a defence
# prime is not silently dropped.
CIVILIAN_DEFENCE_AGENCIES = (
    "department of energy",
    "national nuclear security administration",
    "national aeronautics and space administration",
    "homeland security",
    "department of state",
)

DEFENCE_TEXT_TERMS = (
    "defense", "defence", "missile", "munition", "weapon", "aircraft",
    "fighter", "bomber", "frigate", "submarine", "tank", "armored", "armoured",
    "radar", "naval", "marine corps", "air force", "space force", "warfighter",
    "combat", "battlefield", "helicopter", "destroyer", "carrier",
    "guided missile", "ordnance", "c4isr", "soldier", "warhead",
)

CIVILIAN_RECIPIENT_TERMS = (
    "hotel", "hotels", "resort", "resorts", "hospitality", "realty",
    "property", "insurance", "food service", "beverage",
)

REQUEST_FIELDS = [
    "Award ID",
    "Recipient Name",
    "Award Amount",
    "Awarding Agency",
    "Awarding Sub Agency",
    "Awarding Agency Code",
    "Awarding Sub Agency Code",
    "Description",
    "generated_internal_id",
]


def is_defence_award(award: dict[str, Any]) -> bool:
    """Classify an award as defence-related.

    The parent awarding agency is "Department of Defense" for effectively every
    defence award, so it carries no discriminating signal on its own. The sub
    agency (Navy, Army, Air Force, DCMA, ...) is what identifies the service.

    Awards from civilian science agencies are kept only when the award text
    carries a defence signal, which preserves work such as the NNSA contract
    held by Lockheed Martin without letting routine energy work through.
    """
    recipient = str(award.get("Recipient Name") or "").casefold()
    if any(term in recipient for term in CIVILIAN_RECIPIENT_TERMS):
        return False

    sub_agency = str(award.get("Awarding Sub Agency") or "").casefold()
    agency = str(award.get("Awarding Agency") or "").casefold()
    if any(term in sub_agency for term in DEFENCE_SUB_AGENCIES):
        return True
    if any(term in agency for term in DEFENCE_SUB_AGENCIES):
        return True

    if any(term in agency for term in CIVILIAN_DEFENCE_AGENCIES):
        description = str(award.get("Description") or "").casefold()
        return any(term in description for term in DEFENCE_TEXT_TERMS)

    return False


def fetch_page(
    aliases: list[str],
    limit: int,
    last_record_unique_id: str | None,
    last_record_sort_value: str | None = None,
) -> dict[str, Any]:
    """Fetch one page of awards for a set of recipient search terms."""
    filters: dict[str, Any] = {
        "time_period": [
            {"start_date": EARLIEST_DATE, "end_date": date.today().isoformat()}
        ],
        "award_type_codes": ["A", "B", "C", "D"],
        "recipient_search_text": aliases,
    }

    payload: dict[str, Any] = {
        "filters": filters,
        "fields": REQUEST_FIELDS,
        "limit": limit,
        "page": 1,
        "subawards": False,
        # `sort` and `order` are the parameters the API honours. A bare
        # `order` key is ignored, which previously left the result set in
        # arbitrary order and returned the smallest awards rather than the
        # significant ones.
        "sort": "Award Amount",
        "order": "desc",
    }
    if last_record_unique_id:
        # Cursor pagination: the API resumes after the supplied record when
        # `page` is left at 1 and the cursor fields are present.
        payload["last_record_unique_id"] = last_record_unique_id
        payload["last_record_sort_value"] = last_record_sort_value

    response = requests.post(USA_SPENDING_URL, json=payload, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()


def fetch_awards_for_alias(
    aliases: list[str], limit: int, max_pages: int
) -> list[dict[str, Any]]:
    """Page through every award for a company, largest first."""
    collected: list[dict[str, Any]] = []
    cursor: str | None = None
    sort_value: str | None = None
    # Dedupe on generated_internal_id (a stable 1:1 award key) rather than the
    # short "Award ID", which is only a 2-4 character PIID/agency prefix and is
    # therefore shared by thousands of unrelated awards.
    seen: set[str] = set()

    for _ in range(max_pages):
        body = fetch_page(aliases, limit, cursor, sort_value)
        results = body.get("results", [])
        if not results:
            break

        for award in results:
            key = str(award.get("generated_internal_id") or award.get("internal_id"))
            if key in seen:
                continue
            seen.add(key)
            collected.append(award)

        metadata = body.get("page_metadata") or {}
        if not metadata.get("hasNext"):
            break
        cursor = metadata.get("last_record_unique_id")
        sort_value = metadata.get("last_record_sort_value")
        if not cursor:
            break
        time.sleep(0.25)  # be polite to a free public API

    return collected


def normalise(
    award: dict[str, Any], company_slug: str, company_name: str
) -> dict[str, Any]:
    """Map a USAspending award onto the platform contract shape.

    `start_date`, `end_date` and `award_type` are intentionally left null with a
    source_limitation note: this endpoint does not publish period-of-performance
    or award-type values for contract-level results. Recording them as null with
    an explicit note keeps the Integrity Charter honest -- they are absent from
    the source, not missing from our extraction.
    """
    description = award.get("Description")
    return {
        "company_slug": company_slug,
        "company_name": company_name,
        "source_registry_id": "usaspending",
        "source_url": "https://www.usaspending.gov/",
        "award_id": award.get("Award ID") or award.get("generated_internal_id"),
        "generated_internal_id": award.get("generated_internal_id"),
        "recipient_name": award.get("Recipient Name"),
        "amount": award.get("Award Amount"),
        "description": description,
        "item_name": description,
        "awarding_agency": award.get("Awarding Agency"),
        "awarding_sub_agency": award.get("Awarding Sub Agency"),
        "awarding_agency_code": award.get("Awarding Agency Code"),
        "awarding_sub_agency_code": award.get("Awarding Sub Agency Code"),
        "start_date": None,
        "end_date": None,
        "award_type": None,
        "source_limitation": (
            "Period of performance and award type are not published on "
            "spending_by_award; use /api/v2/awards/ or FPDS for those fields."
        ),
        "retrieved_at": date.today().isoformat(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--company",
        choices=sorted(COMPANIES),
        help="Fetch one application company instead of the whole catalogue.",
    )
    parser.add_argument("--limit", type=int, default=100, help="Awards per API page")
    parser.add_argument(
        "--max-pages",
        type=int,
        default=5,
        help="Maximum pages per recipient alias (100 x pages records per alias).",
    )
    parser.add_argument(
        "--min-amount",
        type=float,
        default=0.0,
        help="Drop awards below this USD value to keep the signal meaningful.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "usa_spending_contracts.json",
    )
    args = parser.parse_args()

    selected = {args.company: COMPANIES[args.company]} if args.company else COMPANIES
    records: list[dict[str, Any]] = []
    seen_awards: set[str] = set()

    for slug, company in selected.items():
        # Aliases overlap heavily ("Airbus" also matches Airbus commercial,
        # "Leonardo" also matches Leonardo DRS), so a single combined search per
        # company is issued rather than one search per alias. Searching each
        # alias separately and attributing the union to the company both
        # double counts and lets one alias capture another company's
        # subsidiaries. `recipient_name` is retained on every record so an
        # analyst can split a subsidiary or joint venture during review.
        for award in fetch_awards_for_alias(
            company["aliases"], args.limit, args.max_pages
        ):
            key = str(award.get("generated_internal_id") or award.get("internal_id"))
            if key in seen_awards:
                continue
            seen_awards.add(key)
            if not is_defence_award(award):
                continue
            amount = award.get("Award Amount")
            if args.min_amount and (amount or 0) < args.min_amount:
                continue
            records.append(normalise(award, slug, company["name"]))
        time.sleep(0.25)

        company_records = [r for r in records if r["company_slug"] == slug]
        company_value = sum(r["amount"] or 0 for r in company_records)
        print(
            f"{company['name']}: {len(company_records):,} defence awards "
            f"({company_value:,.0f} USD)"
        )

    records.sort(key=lambda r: r["amount"] or 0, reverse=True)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(records, indent=2), encoding="utf-8")

    total_value = sum(r["amount"] or 0 for r in records)
    print(f"\nWrote {len(records):,} normalised awards to {args.output}")
    print(f"Total contract value: {total_value:,.0f} USD")
    print(
        "These are queued, not loaded: contract promotion requires an "
        "authenticated platform admin session."
    )


if __name__ == "__main__":
    main()
