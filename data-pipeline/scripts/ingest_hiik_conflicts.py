#!/usr/bin/env python3
"""Ingest the HIIK 2025 armed-conflict dataset into the ingestion review queue.

HIIK (Heidelberg Institute for International Conflict Research) publishes an
annual armed-conflict dataset as a free PDF. This repo already holds a parsed
CSV at ``data/hiik_2025_conflicts.csv`` produced by ``parse_hiik_pdf.py``.

Per the Integrity Charter (section 1.3) every externally sourced record must
pass through the ingestion review pipeline before it enters a core intelligence
table. This script therefore writes to ``ingestion_queue`` only -- it never
writes to ``public.conflicts`` directly. Records land in
``/admin/ingestion`` for an analyst to approve before promotion.

Usage
-----
    ../.venv/bin/python scripts/ingest_hiik_conflicts.py --dry-run
    ../.venv/bin/python scripts/ingest_hiik_conflicts.py
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Any

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = PIPELINE_ROOT / "data" / "hiik_2025_conflicts.csv"

SOURCE_URL = "https://hiik.de/en/medien/downloads-archiv/"

# HIIK region_section -> platform `conflicts.region` vocabulary.
REGION_MAP = {
    "EUROPE": "Europe",
    "ASIA AND OCEANIA": "Asia and Oceania",
    "SUB-SAHARAN AFRICA": "Sub-Saharan Africa",
    "THE AMERICAS": "The Americas",
    "WEST ASIA, NORTH AFRICA, AND AFGHANISTAN": "West Asia, North Africa and Afghanistan",
}

# HIIK status_change -> platform `conflicts.status` check constraint,
# which only allows ('Active', 'Frozen', 'Resolved').
STATUS_MAP = {
    "escalated": "Active",
    "stable": "Frozen",
    "de-escalated": "Resolved",
}

# HIIK conflict names are "Country (issue)" or "Country - Other", e.g.
# "Afghanistan - Iran". The leading token is usually a country, but several are
# cross-border pairs or non-state actors, so this is a best-effort hint only.
COUNTRY_HINT = re.compile(r"^([A-Z][A-Za-z .'-]+?)\s*(?:\(|-)")


def normalise_whitespace(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = " ".join(str(value).split())
    return cleaned or None


def build_summary(row: dict[str, str]) -> str:
    """Compose a human-readable summary from the HIIK evidence excerpt."""
    name = row.get("conflict_name", "Unknown conflict")
    phrase = normalise_whitespace(row.get("intensity_phrase"))
    excerpt = normalise_whitespace(row.get("evidence_excerpt"))
    page = normalise_whitespace(row.get("pdf_page"))

    parts = [name]
    if phrase:
        parts.append(f"Recorded as: {phrase}.")
    if excerpt:
        parts.append(excerpt)
    if page:
        parts.append(f"[HIIK Annual Review 2025, p. {page}]")
    return " ".join(parts)


def derive_country_hint(name: str) -> str | None:
    match = COUNTRY_HINT.match(name)
    if not match:
        return None
    candidate = match.group(1).strip()
    return candidate or None

def transform(rows: list[dict[str, str]]) -> list[dict[str, Any]]:
    """Map HIIK CSV rows onto the ingestion_queue shape."""
    out: list[dict[str, Any]] = []
    for row in rows:
        conflict_name = normalise_whitespace(row.get("conflict_name"))
        if not conflict_name:
            continue

        region_raw = normalise_whitespace(row.get("region_section")) or ""
        status_raw = (normalise_whitespace(row.get("status_change")) or "").lower()
        intensity_raw = (normalise_whitespace(row.get("intensity_level")) or "").strip()

        # parse_hiik_pdf.py emits the literal string "UNKNOWN" when it cannot
        # assign a conflict to one of the five HIIK regional sections. These are
        # real conflicts with a missing region, not a sixth region, so they are
        # mapped to None and flagged via data_confidence rather than being
        # invented into a bucket.
        if region_raw.upper() == "UNKNOWN":
            region: str | None = None
        else:
            region = REGION_MAP.get(region_raw, region_raw or None)

        # status_change also contains a "review" marker for rows that come from
        # the overview table rather than a narrative section.
        if status_raw in STATUS_MAP:
            status = STATUS_MAP[status_raw]
        elif status_raw == "review":
            status = "Frozen"
        else:
            status = "Frozen"

        try:
            intensity = int(intensity_raw) if intensity_raw else None
        except ValueError:
            intensity = None

        # confidence_score is constrained 0-100 in ingestion_queue. HIIK is a
        # single, consistent annual publication parsed directly from the source
        # PDF, so it is strong primary-source material -- but it has not been
        # through analyst review yet, which caps it below "High". Rows with no
        # resolvable region are scored lower because the regional attribute
        # would otherwise be silently absent downstream.
        if intensity is None:
            confidence = 70
        elif region is None:
            confidence = 75
        else:
            confidence = 85

        # Stable dedup key: HIIK conflict names are unique within a year, so
        # slug + page gives a deterministic external_id that re-running the
        # importer can match against instead of creating duplicates.
        page = (normalise_whitespace(row.get("pdf_page")) or "na").lower()
        slug = re.sub(r"[^a-z0-9]+", "-", conflict_name.casefold()).strip("-")[:60]
        external_id = f"hiik-2025:{slug}:p{page}"

        out.append(
            {
                "entity_type": "conflict",
                "entity_id": None,
                "operation": "insert",
                "title": conflict_name,
                "external_id": external_id,
                "normalised_payload": {
                    "name": conflict_name,
                    "region": region,
                    "status": status,
                    "start_date": None,
                    "summary": build_summary(row),
                    "country_hint": derive_country_hint(conflict_name),
                    "intensity_level": intensity,
                    "intensity_phrase": normalise_whitespace(row.get("intensity_phrase")),
                    "status_change": status_raw or None,
                    "evidence_excerpt": normalise_whitespace(row.get("evidence_excerpt")),
                    "evidence_page": normalise_whitespace(row.get("pdf_page")),
                },
                "source_url": SOURCE_URL,
                "data_confidence": "single_source",
                "confidence": confidence,
                "status": "pending",
            }
        )
    return out


# __APPEND_MAIN__


def write_replay_file(records: list[dict[str, Any]], output: Path) -> int:
    """Write the normalised payload batch to a JSON file for admin replay.

    Direct database writes are blocked by row-level security on
    ``ingestion_queue``: the policy requires an authenticated platform admin,
    and the project's ``NEXT_PUBLIC_SUPABASE_ANON_KEY`` is a publishable anon
    key that cannot satisfy that. This honours the Integrity Charter as well --
    records enter the review queue and are promoted by an analyst, never
    written straight into a core intelligence table.
    """
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")
    return len(records)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and report without writing to the database.",
    )
    parser.add_argument("--csv", type=Path, default=CSV_PATH, help="Path to the HIIK CSV.")
    parser.add_argument(
        "--output",
        type=Path,
        default=PIPELINE_ROOT / "data" / "hiik_2025_ingestion_payload.json",
        help="Where to write the normalised ingestion payload.",
    )
    args = parser.parse_args()

    if not args.csv.exists():
        raise SystemExit(f"HIIK CSV not found: {args.csv}")

    with args.csv.open(encoding="utf-8") as handle:
        raw_rows = list(csv.DictReader(handle))

    records = transform(raw_rows)
    regions = sorted({r["normalised_payload"]["region"] for r in records if r["normalised_payload"]["region"]})
    statuses = sorted({r["normalised_payload"]["status"] for r in records})

    print(f"HIIK rows parsed : {len(raw_rows)}")
    print(f"Unique conflicts : {len({r['normalised_payload']['name'] for r in records})}")
    print(f"Regions resolved : {len(regions)}")
    for region in regions:
        print(f"  - {region}")
    print(f"Status mapping   : {statuses}")
    print(f"Missing region   : {sum(1 for r in records if r['normalised_payload']['region'] is None)}")
    print(
        "Confidence tiers : "
        + str(
            {
                tier: sum(1 for r in records if r["confidence"] == score)
                for tier, score in (("high", 85), ("medium", 75), ("low", 70))
            }
        )
    )

    if args.dry_run:
        print("\n--dry-run: nothing written.")
        print("Sample record:")
        print(json.dumps(records[0], indent=2)[:900])
        return

    written = write_replay_file(records, args.output)
    print(f"\nWrote {written} normalised records to {args.output}")
    print(
        "These are queued, not loaded: ingestion_queue is write-protected by "
        "row-level security and requires an authenticated platform admin."
    )
    print("Replay them from an admin session via /api/intelligence/ingestion,")
    print("then approve each record in /admin/ingestion.")


if __name__ == "__main__":
    main()

# __APPEND_POST__


# __APPEND_TRANSFORM__
