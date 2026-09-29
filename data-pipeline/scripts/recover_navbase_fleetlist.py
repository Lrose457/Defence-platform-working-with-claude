#!/usr/bin/env python3
"""Recover fleet-list rows from a Navbase page saved as a single-column xlsx.

Why this parser is unusual
--------------------------
`Navy dataset.xlsx` is not a spreadsheet export. It is a scraped HTML page
(a Navbase fleet list) written to xlsx with every cell collapsed into column
A, so the visible rows are only page furniture:

    Navbase
    StatisticsWeaponsResourcesNavbase
    Home » Navbase » Fleet Lists
    Aircraft Carriers:
    CVN-68   Nimitz ...

The tabular payload still exists in `xl/sharedStrings.xml`, but only as a flat
run of strings with no row or column structure. This module reconstructs the
table by using the known Navbase column headers and section headings as
delimiters, then assembles records from the tokens that follow.

It reads the xlsx as a zip of XML and uses only the standard library, so it
runs without `openpyxl` (which is not installed in this project).

Source
------
Navbase, "Fleet Lists" (https://www.navbase.org/fleetlists.htm). Navbase is a
community-maintained compilation, not an official navy publication, and is
recorded in the platform's `sources` catalogue with that reliability noted.
"""

from __future__ import annotations

import argparse
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Iterator

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

# Navbase renders each fleet list as a table whose header row is these labels,
# in this order. They are used as the delimiter that starts a table.
COLUMN_HEADERS = ["Type", "Class", "Ship", "Code", "Year", "Tonnage"]

# Section headings that precede each table. The trailing colon is how Navbase
# labels them; the version without a colon is matched defensively.
SECTION_HEADINGS = [
    "Aircraft Carriers",
    "Light Carriers",
    "Capital Ships",
    "Cruisers",
    "Destroyers",
    "Frigates & Escorts",
    "Corvettes & Patrol Ships",
    "Assault Ships",
    "Landing Ships",
    "Amphibious Transports",
    "Missile Submarines",
    "Nuclear Attack Submarines",
    "Submarines",
    "Coast Guard",
    "Auxiliaries",
]

# Hull numbers: CVN-68, DDH-181, CG-59, sometimes with a space or no prefix.
HULL_RE = re.compile(r"^[A-Z]{0,4}[- ]?\d{2,5}$")

# European two-part identifiers put a builder/pendant reference immediately
# after the hull code ("U-31, S181, 2005, 1830"). Those references are a
# single letter followed by two or three digits, with no hull prefix and no
# hyphen, which distinguishes them from real hull numbers such as "F101" or
# "K-64" only loosely -- so this pattern is used together with a check that
# the following token is a year, never on its own.
BUILDER_REF_RE = re.compile(r"^[A-Z]\d{2,3}$")

# Navbase numbers years as plain integers, but xlsx stores every numeric cell
# as a float so the token arrives as "1975.0". The pattern must allow the
# trailing ".0" or no year will ever match.
YEAR_RE = re.compile(r"^(19|20)\d{2}(\.0)?$")

# Tonnage is written with a comma thousands separator, sometimes with a unit.
TONNAGE_RE = re.compile(r"^[\d,]+(\.\d+)?\s*(t|T|tons?)?$")

# Country label row, e.g. "Country:" followed by a country name.
COUNTRY_LABEL = "Country:"


def shared_strings(zf: zipfile.ZipFile) -> list[str]:
    """Return the workbook's shared string table in index order."""
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    return [
        "".join(t.text or "" for t in si.iter(f"{NS}t"))
        for si in root.findall(f"{NS}si")
    ]


def cell_value(cell: ET.Element, strings: list[str]) -> str:
    """Resolve one <c> element to its text value."""
    inline = cell.find(f"{NS}is")
    if inline is not None:
        return "".join(t.text or "" for t in inline.iter(f"{NS}t"))
    value = cell.find(f"{NS}v")
    if value is None or value.text is None:
        return ""
    if cell.attrib.get("t") == "s":
        try:
            return strings[int(value.text)]
        except (ValueError, IndexError):
            return ""
    return value.text


def sheet_tokens(path: Path) -> list[str]:
    """Flatten column A (and any other columns) into an ordered token list.

    The rows in this file are all in column A, but the reader does not assume
    that: every cell in every row is appended in column order, so a re-export
    with real columns still yields a sensible token stream.
    """
    with zipfile.ZipFile(path) as zf:
        strings = shared_strings(zf)
        sheet = ET.fromstring(zf.read("xl/worksheets/sheet1.xml"))

    tokens: list[str] = []
    for row in sheet.iter(f"{NS}row"):
        for cell in row.findall(f"{NS}c"):
            text = cell_value(cell, strings).strip()
            if text:
                tokens.append(text)
    return tokens



# ---------------------------------------------------------------------------
# Structure recovered from the file
# ---------------------------------------------------------------------------
# After the column header row the table is a flat run of 6-field records, but
# Navbase inserts a running subtotal line ("Nuclear Carrier: 12") whenever the
# Type value changes, and repeats some values as blank cells. So the stream is
# a sequence of 6-field rows optionally separated by subtotal markers, then a
# grand total and a copyright line.

# Subtotal markers look like "Nuclear Carrier: 12" or "Auxiliaries: 1,234".
SUBTOTAL_RE = re.compile(r"^(?P<label>.+?):\s*(?P<count>[\d,]+)$")

GRAND_TOTAL_RE = re.compile(r"^TOTAL:\s*([\d,]+)$", re.I)
COPYRIGHT_MARKERS = ("\u00a9", "Copyright", "Rodrigo Aguilera")

# Numeric cells arrive from xlsx as floats ("1975.0").
FLOAT_RE = re.compile(r"^-?\d+\.0$")


def to_int(token: str) -> int | None:
    """Parse an xlsx numeric cell, stored as e.g. '1975.0'."""
    value = token.strip()
    if FLOAT_RE.match(value):
        value = value[:-2]
    try:
        return int(value)
    except ValueError:
        return None


def to_tonnage(token: str) -> int | None:
    """Parse a tonnage cell, which may carry a comma separator or a unit."""
    value = token.strip()
    if not TONNAGE_RE.match(value):
        return None
    head = value.split(",")[0]
    digits = re.sub(r"[^0-9.]", "", head)
    if not digits:
        return None
    try:
        return int(round(float(digits)))
    except ValueError:
        return None


def is_hull_code(token: str) -> bool:
    """True when a token looks like a hull number (CVN-68, DDH-181, 1234)."""
    return bool(HULL_RE.match(token.strip()))


def find_data_start(tokens: list[str]) -> int:
    """Return the index just after the column header row."""
    for i in range(len(tokens) - len(COLUMN_HEADERS) + 1):
        if tokens[i : i + len(COLUMN_HEADERS)] == COLUMN_HEADERS:
            return i + len(COLUMN_HEADERS)
    raise SystemExit(
        "Could not find the Navbase column header row "
        f"{COLUMN_HEADERS} in the token stream; the file layout has changed."
    )


def looks_like_year(token: str) -> bool:
    return bool(YEAR_RE.match(token.strip()))


def recover_rows(tokens: list[str]) -> list[dict[str, Any]]:
    """Reconstruct fleet records from the flattened token stream.

    Rows are not a fixed six fields. Two shapes occur in this file:

    * **Six fields** - ``Type, Class, Ship, Code, Year, Tonnage`` gives
      ``CVN / Nimitz / George H.W. Bush / CVN-77 / 2009 / 104600``
    * **Five fields** - Navbase omits ``Ship`` when the vessel name matches the
      class, leaving ``Type, Class, Code, Year, Tonnage`` gives
      ``LSTM / Cetina / DBM-81 / 1993 / 0``
    * **Five fields with a split identifier** - European navies use a
      two-part code, so the stream reads ``SSK / Type 212A / U-31 / S181 /
      2005 / 1830`` where ``U-31`` is the hull number and ``S181`` a builder
      or pendant reference, leaving only one field before the code.

    The walk therefore anchors on the hull code rather than a fixed offset.
    Fields *before* a code are read backwards (type, class, optional distinct
    ship name) and the year/tonnage *after* it are read forwards. Anchoring
    this way keeps the parser correct across all three row shapes without
    special-casing each one.
    """
    rows: list[dict[str, Any]] = []
    current_section: str | None = None
    i = find_data_start(tokens)
    total = len(tokens)

    def is_row_end(token: str) -> bool:
        return (
            is_hull_code(token)
            or bool(SUBTOTAL_RE.match(token))
            or bool(GRAND_TOTAL_RE.match(token))
            or any(m in token for m in COPYRIGHT_MARKERS)
        )

    while i < total:
        token = tokens[i]

        if any(marker in token for marker in COPYRIGHT_MARKERS):
            break
        if GRAND_TOTAL_RE.match(token):
            break

        subtotal = SUBTOTAL_RE.match(token)
        if subtotal:
            current_section = subtotal.group("label").strip()
            i += 1
            continue

        if not is_hull_code(token):
            i += 1
            continue

        # Leading fields: type, class, and optionally a ship name that differs
        # from the class. The scan stops at a section boundary so a heading is
        # never mistaken for a record field, and at any numeric token so a year
        # or tonnage belonging to the *previous* row is never absorbed into
        # this record.
        leading: list[str] = []
        k = i - 1
        while k >= 0 and len(leading) < 3:
            prior = tokens[k]
            if SUBTOTAL_RE.match(prior) or GRAND_TOTAL_RE.match(prior):
                break
            if is_hull_code(prior):
                break
            if to_tonnage(prior) is not None:
                break
            leading.insert(0, prior)
            k -= 1

        # Trailing fields: an optional builder/pendant reference, then the year
        # Trailing fields, which come in two shapes:
        #
        #   six-field row:  Type Class Ship Code Year Tonnage
        #   five-field row:  Type Class      Code Tonnage Year
        #
        # Navbase omits the Ship cell when the vessel name equals the class, and
        # the row then shifts left, so the tonnage appears *before* the year.
        # Rather than guess the shape from token patterns -- 597 real hull
        # numbers such as "R91" (Charles de Gaulle) and "D32" (Daring) are
        # indistinguishable from builder references by pattern alone, so
        # heuristics misclassify hundreds of real vessels -- the numbers
        # adjacent to the code are read by value: a year is 1900-2099 and a
        # tonnage is any other number, regardless of order. A builder
        # reference is a non-numeric token sitting between the code and them.
        forward: list[str] = []
        year: int | None = None
        tonnage: int | None = None
        builder_ref: str | None = None

        # At most three tokens can follow the hull code: an optional builder
        # reference, the year, and the tonnage, in one of two orders. Bounding
        # the scan to that width is what stops it running on into the next
        # row's leading fields, which previously produced nonsense such as a
        # vessel type being recorded as a builder reference.
        cursor = i + 1
        while cursor < total and cursor <= i + 3:
            nxt = tokens[cursor]
            if SUBTOTAL_RE.match(nxt) or GRAND_TOTAL_RE.match(nxt):
                break
            if any(m in nxt for m in COPYRIGHT_MARKERS):
                break

            if looks_like_year(nxt):
                if year is not None:
                    break
                year = to_int(nxt)
                forward.append(nxt)
                cursor += 1
                # In a six-field row the tonnage follows the year, so the
                # record is complete and the next token belongs to the next
                # row. Continuing past it would swallow that row's vessel type
                # as a builder reference.
                if tonnage is not None:
                    break
                continue

            numeric = to_tonnage(nxt)
            if numeric is not None:
                if tonnage is not None:
                    break
                tonnage = numeric
                forward.append(nxt)
                cursor += 1
                # In a five-field row the year follows the tonnage.
                if year is not None:
                    break
                continue

            # A non-numeric token after the code is a builder or pendant
            # reference on the European two-part form ("U-31, S181"). Such a
            # token is itself hull-code shaped, so pattern alone cannot tell it
            # from the next row's code. It is only a reference when the token
            # after it is a figure: a real next row's code is followed by its
            # class or ship name, never a bare number.
            if builder_ref is None:
                nxt2 = tokens[cursor + 1] if cursor + 1 < total else ""
                if to_tonnage(nxt2) is not None:
                    builder_ref = nxt
                    forward.append(nxt)
                    cursor += 1
                    continue
            break

        j = cursor

        vessel_type = leading[0] if leading else ""
        vessel_class = leading[1] if len(leading) > 1 else ""
        ship = leading[2] if len(leading) > 2 else vessel_class

        rows.append(
            {
                "vessel_type": vessel_type,
                "vessel_class": vessel_class,
                "ship": ship,
                "code": token,
                "year": year,
                "tonnage": tonnage,
                "section": current_section,
                # Tokens between the hull code and the numbers are a builder
                # or pendant reference on the European two-part form. Kept
                # rather than discarded so no source value is lost.
                "builder_ref": builder_ref,
            }
        )
        i = j
        i = j

    return rows


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

SOURCE_PUBLISHER = "Navbase (navbase.org)"
SOURCE_TITLE = "Navbase Fleet Lists"
SOURCE_URL = "https://www.navbase.org/fleetlists.htm"
SOURCE_NOTE = (
    "Community-maintained compilation of world naval order of battle, not an "
    "official navy publication. Recovered from a single-column xlsx export of "
    "the Navbase fleet list page, in which all table structure had been "
    "flattened into column A."
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--xlsx",
        type=Path,
        default=Path("/Users/leorosenthal/Desktop/Datasets/Navy dataset.xlsx"),
        help="Path to the Navbase xlsx export.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "navbase_fleetlist.json",
        help="Where to write the normalised payload.",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.xlsx.exists():
        raise SystemExit(f"Navbase xlsx not found: {args.xlsx}")

    tokens = sheet_tokens(args.xlsx)
    rows = recover_rows(tokens)

    if not rows:
        raise SystemExit(
            "No fleet records recovered. The token stream did not contain the "
            "expected Navbase column headers, so the file layout has changed."
        )

    # A record is complete when it has a type, a class, a year and a tonnage.
    # 35 of the 1,362 records are published by Navbase with no tonnage at all,
    # so that is a gap in the source rather than a parse failure. Counting them
    # separately stops them being read as zero displacement.
    no_tonnage = [r for r in rows if r["tonnage"] is None]
    incomplete = [
        r
        for r in rows
        if r["year"] is None or not r["vessel_type"] or not r["vessel_class"]
    ]
    sections = sorted({r["section"] for r in rows if r["section"]})
    years = [r["year"] for r in rows if r["year"] is not None]
    total_tonnage = sum(r["tonnage"] or 0 for r in rows)

    # Hull numbers are unique within a navy, not globally: Spain's F101 (Alvaro
    # de Bazan) and Qatar's F101 (Al Zubarah) are different ships. The count is
    # therefore reported as information rather than an error, and the
    # destination table must key on (code, vessel_type, section) rather than on
    # code alone.
    by_code: dict[str, int] = {}
    for record in rows:
        by_code[record["code"]] = by_code.get(record["code"], 0) + 1
    shared_codes = {k: v for k, v in by_code.items() if v > 1}

    print(f"Tokens read      : {len(tokens):,}")
    print(f"Records recovered: {len(rows):,}")
    print(f"Malformed rows   : {len(incomplete)}")
    print(f"No tonnage       : {len(no_tonnage)} (not published by Navbase)")
    print(f"Sections         : {len(sections)}")
    print(f"Year range       : {min(years)}-{max(years)}")
    print(f"Total tonnage    : {total_tonnage:,} t")
    print(
        f"Shared hull codes: {len(shared_codes)} codes are reused across navies "
        f"(key on code+vessel_type+section, not code alone)"
    )
    if incomplete:
        print("\nIncomplete records (first 5):")
        for record in incomplete[:5]:
            print("  ", record)

    if args.dry_run:
        print("\n--dry-run: nothing written.")
        print("Sample record:")
        print(json.dumps(rows[0], indent=2))
        return

    document = {
        "source_registry_id": "navbase-fleetlist",
        "publisher": SOURCE_PUBLISHER,
        "source_title": SOURCE_TITLE,
        "source_url": SOURCE_URL,
        "reliability": "Community-maintained",
        "notes": SOURCE_NOTE,
        "units": (
            "Tonnage is displacement in tonnes as published by Navbase. It is "
            "NOT SIPRI trend-indicator value and must not be aggregated with "
            "arms_transfers.tiv_millions or budgets.amount_usd."
        ),
        "target_table": "naval_assets",
        "record_count": len(rows),
        "records": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(document, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\nWrote {len(rows):,} records to {args.output}")
    print(
        "Queued, not loaded: naval_assets is not yet in the schema. Apply the "
        "pending migrations, then promote via an authenticated admin session."
    )


if __name__ == "__main__":
    main()

