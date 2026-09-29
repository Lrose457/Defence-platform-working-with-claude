#!/usr/bin/env python3
"""Parse the SIPRI Arms Transfers Database CSV exports into reviewable records.

SIPRI publishes volume of transfers of major arms in *trend-indicator values*
(TIV), measured in millions. TIV is a capability volume index, not currency, and
is not comparable to financial expenditure, so this importer never emits a
currency field.

The two CSVs are wide -- one row per country, one column per year -- and are
melted to one row per (country, direction, year).

SIPRI's own cell conventions are preserved rather than coerced to 0, which
would understate transfers:

    '0'   volume between 0 and 0.5 million TIV
    '..'  value not available
    ''    no deliveries identified

Usage
-----
    ../.venv/bin/python scripts/parse_sipri_transfers.py --dry-run
    ../.venv/bin/python scripts/parse_sipri_transfers.py
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Any

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_DIR = Path("/Users/leorosenthal/Desktop/Datasets/nations")
DEFAULT_OUTPUT = PIPELINE_ROOT / "data" / "sipri_arms_transfers.json"

SOURCE_URL = "https://www.sipri.org/databases/armstransfers"
PUBLISHER = "Stockholm International Peace Research Institute (SIPRI)"

# The header is preceded by a SIPRI metadata preamble; find the real header row.
HEADER_KEYS = {"recipient", "supplier"}


def find_header(rows: list[list[str]]) -> tuple[int, list[str]]:
    for index, row in enumerate(rows):
        if row and row[0].strip().casefold() in HEADER_KEYS:
            return index, row
    raise SystemExit(
        "Could not find a Recipient/Supplier header row. The CSV may be empty "
        "or truncated -- re-export it from sipri.org and confirm the file is "
        "larger than a few kilobytes."
    )


def classify(raw: str) -> tuple[float | None, str]:
    """Map a SIPRI cell to (tiv_millions, tiv_status)."""
    value = (raw or "").strip()
    if value == "":
        return None, "none"
    if value in ("..", "-"):
        return None, "unavailable"
    if value == "0":
        # SIPRI writes 0 to mean "between 0 and 0.5 million TIV", not zero.
        return 0.0, "lt_half"

    cleaned = re.sub(r"[^0-9.\-]", "", value)
    if cleaned in ("", "-", "."):
        return None, "unknown"
    try:
        return float(cleaned), "value"
    except ValueError:
        return None, "unknown"

    try:
        return float(cleaned), "value"
    except ValueError:
        return None, "unknown"


def parse_file(path: Path, direction: str) -> list[dict[str, Any]]:
    """Melt one wide SIPRI export into one record per country and year."""
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.reader(handle))

    header_index, header = find_header(rows)

    # Locate four-digit year columns, skipping the trailing aggregates
    # (2000-2025, Percentage, Sum total years).
    years: list[tuple[int, int]] = []
    for column_index, cell in enumerate(header):
        token = (cell or "").strip()
        if re.fullmatch(r"(19|20)\d{2}", token):
            years.append((column_index, int(token)))

    if not years:
        raise SystemExit(f"{path.name}: no year columns found in the header.")

    records: list[dict[str, Any]] = []
    for row in rows[header_index + 1 :]:
        if not row or not (row[0] or "").strip():
            continue
        country_name = row[0].strip()
        if country_name.casefold() in HEADER_KEYS:
            continue

        for column_index, year in years:
            raw = row[column_index] if column_index < len(row) else ""
            tiv, status = classify(raw)
            records.append(
                {
                    "year": year,
                    "direction": direction,
                    "country_name": country_name,
                    "tiv_millions": tiv,
                    "tiv_status": status,
                    "source_registry_id": "sipri-arms-transfers",
                    "source_url": SOURCE_URL,
                    "data_confidence": "primary_source",
                }
            )

    return records


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    exports_path = args.source_dir / "SIRPI weapon exports 2000-2025.csv"
    imports_path = args.source_dir / "SIRPI weapon imports 2000-2025.csv"

    for path in (exports_path, imports_path):
        if not path.exists():
            raise SystemExit(f"Missing SIPRI export: {path}")

    records: list[dict[str, Any]] = []
    for path, direction in ((imports_path, "import"), (exports_path, "export")):
        parsed = parse_file(path, direction)
        print(f"{path.name}: {len(parsed):,} records ({direction})")
        records.extend(parsed)

    if not records:
        raise SystemExit(
            "No transfer records parsed. Both CSVs contain only the SIPRI "
            "metadata preamble and header row.\n"
            "Re-export from https://www.sipri.org/databases/armstransfers "
            "(free registration) and confirm the file contains country rows."
        )

    with_value = [r for r in records if r["tiv_status"] == "value"]
    years = sorted({r["year"] for r in records})
    countries = len({r["country_name"] for r in records})
    by_status: dict[str, int] = {}
    for record in records:
        by_status[record["tiv_status"]] = by_status.get(record["tiv_status"], 0) + 1

    print(f"\nTotal records : {len(records):,}")
    print(f"Years         : {years[0]}-{years[-1]} ({len(years)})")
    print(f"Entities      : {countries}")
    print(f"Cell statuses : {by_status}")
    print(f"Numeric TIV   : {len(with_value):,}")

    if args.dry_run:
        print("\n--dry-run: nothing written.")
        print("Sample numeric record:")
        sample = with_value[0] if with_value else records[0]
        print(json.dumps(sample, indent=2))
        return

    document = {
        "source_registry_id": "sipri-arms-transfers",
        "publisher": PUBLISHER,
        "source_url": SOURCE_URL,
        "licence": "SIPRI data is free for non-commercial use with attribution; "
                   "see https://www.sipri.org/databases/armstransfers",
        "units": "Millions of SIPRI trend-indicator values (TIV). TIV is a "
                 "capability volume index, not currency, and is not comparable "
                 "to budgets.amount_usd.",
        "target_table": "arms_transfers",
        "cell_conventions": {
            "value": "numeric TIV figure",
            "lt_half": "'0' in source: between 0 and 0.5 million TIV",
            "none": "no deliveries identified",
            "unavailable": "'..' in source: value not available",
        },
        "record_count": len(records),
        "records": records,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(document, indent=2), encoding="utf-8")

    print(f"\nWrote {len(records):,} records to {args.output}")
    print(
        "Queued, not loaded: apply supabase/migrations/20260930_arms_transfers.sql "
        "first, then promote via an authenticated admin session."
    )


if __name__ == "__main__":
    main()
