#!/usr/bin/env python3
"""
Comprehensive GLEIF Data Ingestion Pipeline.

Pipeline phases:
  1. Download  — fetch Level 1 LEI + Level 2 RR Golden Copy zip files
  2. Verify    — validate ZIP integrity and JSON structure
  3. Ingest RR — stream Level 2 relationship records into Neo4j
  4. Enrich    — stream Level 1 LEI entity details & enrich Company nodes
  5. Verify    — confirm the 100 target companies are present in Neo4j

Usage:
    python3 scripts/ingest_gleif.py                 # run all phases
    python3 scripts/ingest_gleif.py --verify         # verify data only
    python3 scripts/ingest_gleif.py --ingest-rr      # load relationships
    python3 scripts/ingest_gleif.py --enrich-lei2    # enrich with entity data
    python3 scripts/ingest_gleif.py --verify-companies
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import zipfile
from pathlib import Path
from typing import Any

import ijson
from dotenv import load_dotenv
from neo4j import GraphDatabase
import requests
from docx import Document as DocxDocument

# ── Configuration ──────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "data"

LEI2_URL = "https://goldencopy.gleif.org/api/v2/golden-copies/publishes/lei2/latest.json"
RR_URL = "https://goldencopy.gleif.org/api/v2/golden-copies/publishes/rr/latest.json"

LEI2_ZIP = DATA_DIR / "lei2_latest.json.zip"
RR_ZIP = DATA_DIR / "rr_latest.json.zip"
RR_JSON = None  # Will be auto-detected from extracted zip contents
LEI2_JSON_PATH = None  # LEI2 is streamed from zip directly (13+ GB uncompressed)

def find_rr_json():
    """Find the extracted RR JSON file in the data directory."""
    for f in DATA_DIR.glob("*goldencopy-rr-golden-copy.json"):
        return f
    for f in DATA_DIR.glob("*.json"):
        if "rr" in f.name.lower():
            return f
    return DATA_DIR / "gleif-rr-golden-copy.json"
DOCX_PATH = Path(
    os.environ.get("DOCX_PATH", "/Users/leorosenthal/Downloads/Company data .docx")
)
BATCH_SIZE = 5_000
REQUEST_TIMEOUT = 120

DEFENSE_KEYWORDS = (
    "defense", "defence", "aerospace", "munition", "armament",
    "tactical", "military", "missile", "shipbuilding", "lockheed",
    "raytheon", "rheinmetall", "thales", "baesystems", "norinco",
    "airbus", "aviation industry", "naval group", "knds", "kawasaki",
    "submarine", "boeing", "northrop grumman", "general dynamics",
    "safran", "rolls-royce", "huntington ingalls", "leidos", "l3harris",
    "elbit", "israel aerospace", "ultra electronics", "kaman", "chemring",
    "baykar", "qinetiq", "vectrus", "amtek", "nammo", "patria",
    "teledyne", "woodward", "transdigm", "cubic", "curtiss-wright",
    "diehl", "bwxt", "hanwha", "edge", "cssc", "casc", "cetc", "caci",
    "booz allen", "amentum", "honeywell", "ge aerospace", "saab",
    "mbda", "dassault", "kaman", "submarine", "aircraft carrier",
)

# ── Neo4j Schema ───────────────────────────────────────────────────────

CREATE_SCHEMA = """
CREATE CONSTRAINT company_lei_unique IF NOT EXISTS
FOR (company:Company) REQUIRE company.lei IS UNIQUE
"""

CREATE_INDEXES = [
    "CREATE INDEX company_name IF NOT EXISTS FOR (c:Company) ON (c.name)",
    "CREATE INDEX company_defense IF NOT EXISTS FOR (c:Company) ON (c.is_defense)",
    "CREATE INDEX company_country IF NOT EXISTS FOR (c:Company) ON (c.legal_address_country)",
]

UPSERT_RR = """
UNWIND $rows AS row
MERGE (child:Company {lei: row.child_lei})
SET child.name = coalesce(row.child_name, child.name),
    child.is_defense = coalesce(child.is_defense, false) OR row.child_is_defense
MERGE (parent:Company {lei: row.parent_lei})
SET parent.name = coalesce(row.parent_name, parent.name),
    parent.is_defense = coalesce(parent.is_defense, false) OR row.parent_is_defense
MERGE (child)-[r:OWNED_BY_PARENT]->(parent)
SET r.relationship_type = coalesce(row.relationship_type, r.relationship_type),
    r.start_date = coalesce(row.start_date, r.start_date),
    r.end_date = coalesce(row.end_date, r.end_date),
    r.relationship_status = coalesce(row.relationship_status, r.relationship_status)
"""

UPSERT_LEI2 = """
UNWIND $rows AS row
MERGE (company:Company {lei: row.lei})
SET company.name = coalesce(row.name, company.name),
    company.legal_address = coalesce(row.legal_address, company.legal_address),
    company.legal_address_city = coalesce(row.legal_address_city, company.legal_address_city),
    company.legal_address_region = coalesce(row.legal_address_region, company.legal_address_region),
    company.legal_address_country = coalesce(row.legal_address_country, company.legal_address_country),
    company.legal_address_postal_code = coalesce(row.legal_address_postal_code, company.legal_address_postal_code),
    company.legal_jurisdiction = coalesce(row.legal_jurisdiction, company.legal_jurisdiction),
    company.entity_status = coalesce(row.entity_status, company.entity_status),
    company.legal_form_code = coalesce(row.legal_form_code, company.legal_form_code),
    company.legal_form_other = coalesce(row.legal_form_other, company.legal_form_other),
    company.entity_category = coalesce(row.entity_category, company.entity_category),
    company.sic_codes = CASE WHEN row.sic_codes IS NOT NULL THEN row.sic_codes ELSE company.sic_codes END,
    company.naics_codes = CASE WHEN row.naics_codes IS NOT NULL THEN row.naics_codes ELSE company.naics_codes END,
    company.hq_address_city = coalesce(row.hq_address_city, company.hq_address_city),
    company.hq_address_country = coalesce(row.hq_address_country, company.hq_address_country),
    company.first_entity_registration_date = coalesce(row.first_entity_registration_date, company.first_entity_registration_date),
    company.last_update_date = coalesce(row.last_update_date, company.last_update_date),
        company.is_defense = coalesce(company.is_defense, false) OR row.is_defense,
    company.updated_at = timestamp()
"""

# ── Helper Functions ───────────────────────────────────────────────────


def is_defense_related(company_name: str | None) -> bool:
    """Return whether a company name matches a defense-sector keyword."""
    if not company_name:
        return False
    normalized = company_name.casefold()
    return any(kw in normalized for kw in DEFENSE_KEYWORDS)


def gleif_val(obj: Any) -> str | None:
    """Extract text value from a GLEIF XML-to-JSON element.

    In GLEIF's XML-to-JSON conversion, text content lives under the ``$`` key:
    ``<City>BOSTON</City>`` → ``{"City": {"$": "BOSTON"}}``
    """
    if isinstance(obj, dict):
        if "$" in obj:
            v = obj["$"]
            return v.strip() if isinstance(v, str) and v.strip() else None
        return None
    if isinstance(obj, str) and obj.strip():
        return obj.strip()
    return None


def gleif_get(record: dict[str, Any], *path: str) -> str | None:
    """Navigate nested dicts by key path, then extract via :func:`gleif_val`."""
    value: Any = record
    for key in path:
        if not isinstance(value, dict):
            return None
        value = value.get(key)
        if value is None:
            return None
    return gleif_val(value)


def gleif_get_list(record: dict[str, Any], *path: str) -> list[str] | None:
    """Extract a list of string values; handles single dict or list of dicts."""
    value: Any = record
    for key in path:
        if not isinstance(value, dict):
            return None
        value = value.get(key)
        if value is None:
            return None
    items = [value] if isinstance(value, dict) else (value if isinstance(value, list) else [])
    result = [gleif_val(v) for v in items]
    result = [r for r in result if r]
    return result if result else None


def gleif_get_codes(record: dict[str, Any], *path: str) -> list[dict[str, str]] | None:
    """Extract list of {code, description} from SIC/NAICS-style nested objects."""
    value: Any = record
    for key in path:
        if not isinstance(value, dict):
            return None
        value = value.get(key)
        if value is None:
            return None
    items = [value] if isinstance(value, dict) else (value if isinstance(value, list) else [])
    codes: list[dict[str, str]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        raw_code = item.get("code", item)
        desc = gleif_val(item.get("description"))
        code = gleif_val(raw_code) if isinstance(raw_code, (dict, str)) else None
        if code:
            codes.append({"code": code, "description": desc or ""})
    return codes if codes else None


def normalize_name(name: str) -> str:
    """Normalize a company name for fuzzy matching."""
    if not name:
        return ""
    n = name.casefold()
    n = re.sub(r"[^\w\s]", " ", n)
    n = re.sub(
        r"\b(corporation|corp|inc|llc|llp|ltd|pllc|plc|holdings|group|"
        r"co\b|company|cos|sa|a\s*a\s*r\s*l)\b",
        " ",
        n,
    )
    return re.sub(r"\s+", " ", n).strip()


def parse_target_companies(docx_path: Path) -> list[tuple[str, str]]:
    """Extract (company_name, country) tuples from the reference .docx."""
    doc = DocxDocument(str(docx_path))
    companies: list[tuple[str, str]] = []
    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells]
            if not any(cells):
                continue
            # Data rows start with a numeric rank (1-100)
            if cells and re.match(r"^\d+$", cells[0]):
                if len(cells) >= 3:
                    companies.append((cells[1], cells[2]))
    # Deduplicate
    seen: set[str] = set()
    unique: list[tuple[str, str]] = []
    for name, country in companies:
        if name.lower() not in seen:
            seen.add(name.lower())
            unique.append((name, country))
    return unique


def run_batch(driver, rows, query):
    """Execute a batch write to Neo4j."""
    with driver.session() as session:
        session.execute_write(
            lambda tx: tx.run(query, rows=rows).consume()
        )


# ── Download ───────────────────────────────────────────────────────────


def download_zip(url: str, dest: Path) -> bool:
    """Download a zip file from a URL that may redirect to the actual file."""
    print(f"  Downloading from: {url}")
    response = requests.get(url, stream=True, timeout=REQUEST_TIMEOUT, allow_redirects=True)
    response.raise_for_status()

    total = int(response.headers.get("content-length", 0))
    if total:
        print(f"  Expected size: {total / 1024 / 1024:.1f} MB")

    dest.parent.mkdir(parents=True, exist_ok=True)
    downloaded = 0
    start = time.time()
    with open(dest, "wb") as f:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if chunk:
                f.write(chunk)
                downloaded += len(chunk)
                if downloaded % (50 * 1024 * 1024) == 0:
                    speed = downloaded / (time.time() - start) / 1024 / 1024
                    print(f"  {downloaded / 1024 / 1024:.0f} MB ({speed:.1f} MB/s)")
    elapsed = time.time() - start
    print(f"  Downloaded {downloaded / 1024 / 1024:.0f} MB in {elapsed:.1f}s")
    return True


def ensure_zip_downloaded(url: str, dest: Path) -> bool:
    """Download a zip file if it doesn't already exist."""
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  ✓ {dest.name} exists "
              f"({dest.stat().st_size / 1024 / 1024:.0f} MB)")
        return True
    return download_zip(url, dest)


# ── Verification ───────────────────────────────────────────────────────


def verify_zip(zip_path: Path, expected_prefix: str) -> bool:
    """Verify ZIP integrity and JSON structure by sampling records."""
    print(f"\n  Verifying: {zip_path.name}")
    if not zip_path.exists():
        print(f"    ✗ File not found!")
        return False

    size_mb = zip_path.stat().st_size / 1024 / 1024
    print(f"    File size: {size_mb:.1f} MB")

    try:
        with zipfile.ZipFile(zip_path) as z:
            names = z.namelist()
            print(f"    Contents: {names}")
            bad = z.testzip()
            if bad is not None:
                print(f"    ✗ CRC check failed for: {bad}")
                return False
            print(f"    ✓ ZIP integrity (CRC) passed")

            with z.open(names[0]) as f:
                count = 0
                for record in ijson.items(f, f"{expected_prefix}.item"):
                    count += 1
                    if count >= 3:
                        break
                print(f"    ✓ JSON valid — parsed {count} sample records")
                return True
    except Exception as e:
        print(f"    ✗ Error: {e}")
        return False


def verify_extracted_json(json_path: Path, expected_prefix: str) -> bool:
    """Verify an extracted JSON file by parsing a sample."""
    print(f"\n  Verifying extracted JSON: {json_path.name}")
    if not json_path.exists():
        print(f"    ✗ File not found!")
        return False
    size_gb = json_path.stat().st_size / 1024 / 1024 / 1024
    print(f"    File size: {size_gb:.2f} GB")
    try:
        with open(json_path, "rb") as f:
            count = 0
            for _ in ijson.items(f, f"{expected_prefix}.item"):
                count += 1
                if count >= 3:
                    break
            print(f"    ✓ JSON valid — parsed {count} sample records")
        return True
    except Exception as e:
        print(f"    ✗ Error: {e}")
        return False


# ── Level 2 RR Ingestion ───────────────────────────────────────────────


def parse_rr_record(record):
    """Parse a Level 2 Relationship Record from the GLEIF golden copy JSON.

    Structure:
        RelationshipRecord.Relationship.StartNode.NodeID.$  → child LEI
        RelationshipRecord.Relationship.EndNode.NodeID.$   → parent LEI
        RelationshipRecord.Relationship.RelationshipType.$ → e.g. DIRECT_PARENT
    """
    rr = record.get("RelationshipRecord", record)
    relationship = rr.get("Relationship", rr)

    start_node = relationship.get("StartNode", {})
    end_node = relationship.get("EndNode", {})

    child_lei = gleif_val(start_node.get("NodeID")) or gleif_get(record, "StartNode", "NodeID")
    parent_lei = gleif_val(end_node.get("NodeID")) or gleif_get(record, "EndNode", "NodeID")

    if not child_lei or not parent_lei:
        child_lei = child_lei or gleif_get(record, "ChildEntity", "LEI")
        parent_lei = parent_lei or gleif_get(record, "ParentEntity", "LEI")

    if not child_lei or not parent_lei:
        return None

    rel_type = gleif_val(relationship.get("RelationshipType"))
    rel_status = gleif_val(relationship.get("RelationshipStatus"))

    start_date, end_date = None, None
    periods = relationship.get("RelationshipPeriods", {})
    if isinstance(periods, dict):
        period = periods.get("RelationshipPeriod")
        if isinstance(period, dict):
            start_date = gleif_val(period.get("StartDate"))
            end_date = gleif_val(period.get("EndDate"))
        elif isinstance(period, list) and period:
            start_date = gleif_val(period[0].get("StartDate"))
            end_date = gleif_val(period[0].get("EndDate"))

    return {
        "child_lei": child_lei,
        "child_name": None,
        "child_is_defense": False,
        "parent_lei": parent_lei,
        "parent_name": None,
        "parent_is_defense": False,
        "relationship_type": rel_type,
        "start_date": start_date,
        "end_date": end_date,
        "relationship_status": rel_status,
    }


def ingest_level2_rr(driver, json_path, zip_path):
    """Stream Level 2 RR data into Neo4j. Returns set of all unique LEIs."""
    print("\n" + "=" * 70)
    print("PHASE: Ingesting Level 2 Relationship Records")
    print("=" * 70)

    if json_path and json_path.exists():
        print(f"  Source: {json_path.name} "
              f"({json_path.stat().st_size / 1024 / 1024:.0f} MB)")
        file_obj = open(json_path, "rb")
        close_fn = file_obj.close
    elif zip_path and zip_path.exists():
        print(f"  Source: streaming from {zip_path.name}")
        zf = zipfile.ZipFile(zip_path)
        file_obj = zf.open(zf.namelist()[0])
        close_fn = zf.close
    else:
        print("  ✗ No RR data source found!")
        return set()

    count = 0
    batch = []
    all_leis = set()
    rel_types = set()
    skipped = 0
    start = time.time()

    try:
        for record in ijson.items(file_obj, "relations.item"):
            row = parse_rr_record(record)
            if row is None:
                skipped += 1
                continue
            batch.append(row)
            all_leis.add(row["child_lei"])
            all_leis.add(row["parent_lei"])
            if row["relationship_type"]:
                rel_types.add(row["relationship_type"])

            if len(batch) >= BATCH_SIZE:
                run_batch(driver, batch, UPSERT_RR)
                count += len(batch)
                elapsed = time.time() - start
                rate = count / elapsed if elapsed > 0 else 0
                print(f"  {count:,} relationships | {len(all_leis):,} LEIs | "
                      f"{rate:.0f} rec/s | types: {sorted(rel_types)[:3]}")
                batch = []

        if batch:
            run_batch(driver, batch, UPSERT_RR)
            count += len(batch)

        elapsed = time.time() - start
        print(f"\n  ✓ Done: {count:,} relationships in {elapsed / 60:.1f} min")
        print(f"  ✓ Unique LEIs: {len(all_leis):,}")
        print(f"  ✓ Relationship types: {sorted(rel_types)}")
        if skipped:
            print(f"  ⚠ Skipped {skipped:,} unparseable records")
        return all_leis
    finally:
        close_fn()


# ── Level 1 LEI Enrichment ─────────────────────────────────────────────


def parse_lei2_record(record):
    """Parse a Level 1 LEI record for entity details.

    Returns a dict suitable for UPSERT_LEI2, or None if no LEI found.
    """
    lei = gleif_get(record, "LEI")
    if not lei:
        return None

    entity = record.get("Entity", {})
    name = gleif_get(entity, "LegalName")

    addr = entity.get("LegalAddress", {})
    hq = entity.get("HeadquartersAddress", {})

    sic_codes = gleif_get_codes(entity, "SICCodes", "SICCode")
    naics_codes = gleif_get_codes(entity, "NAICS", "NAICSCode")

    # Check Extension for SIC/NAICS if not found in Entity
    if not sic_codes or not naics_codes:
        ext = record.get("Extension") or {}
        if not sic_codes and "SICCodes" in ext:
            sic_codes = gleif_get_codes(ext, "SICCodes", "SICCode")
        if not naics_codes and "NAICS" in ext:
            naics_codes = gleif_get_codes(ext, "NAICS", "NAICSCode")

    registration = record.get("Registration", {})

    return {
        "lei": lei,
        "name": name,
        "legal_address": gleif_get(addr, "FirstAddressLine"),
        "legal_address_city": gleif_get(addr, "City"),
        "legal_address_region": gleif_get(addr, "Region"),
        "legal_address_country": gleif_get(addr, "Country"),
        "legal_address_postal_code": gleif_get(addr, "PostalCode"),
        "legal_jurisdiction": gleif_get(entity, "LegalJurisdiction"),
        "entity_status": gleif_get(entity, "EntityStatus"),
        "legal_form_code": gleif_get(entity.get("LegalForm", {}), "EntityLegalFormCode"),
        "legal_form_other": gleif_get(entity.get("LegalForm", {}), "OtherLegalForm"),
        "entity_category": gleif_get(entity, "EntityCategory"),
        "sic_codes": sic_codes,
        "naics_codes": naics_codes,
        "hq_address_city": gleif_get(hq, "City"),
        "hq_address_country": gleif_get(hq, "Country"),
        "first_entity_registration_date": gleif_get(registration, "InitialRegistrationDate"),
        "last_update_date": gleif_get(registration, "LastUpdateDate"),
        "is_defense": is_defense_related(name),
    }


def enrich_level1_lei(driver, zip_path, target_leis, target_company_names):
    """Stream LEI2 data from zip and enrich Company nodes.

    For each record:
    1. If the LEI is in *target_leis* → enrich the Company node with entity details
    2. If the name matches a target company → record the match

    Returns dict with stats.
    """
    print("\n" + "=" * 70)
    print("PHASE: Enriching Company nodes with Level 1 LEI data")
    print("=" * 70)

    if target_leis:
        print(f"  LEIs to enrich (from RR data): {len(target_leis):,}")
    print(f"  Target company names to search: {len(target_company_names)}")

    # Pre-normalize target names
    target_names_norm = {}
    target_keywords = {}
    for name in target_company_names:
        norm = normalize_name(name)
        target_names_norm[norm] = name
        words = [w for w in norm.split() if len(w) > 3]
        target_keywords[name] = words

    count = 0
    enriched = 0
    found_companies: set[str] = set()
    found_sic = 0
    found_naics = 0
    batch = []
    start = time.time()

    with zipfile.ZipFile(zip_path) as z:
        fname = z.namelist()[0]
        print(f"  Streaming from: {fname}")
        with z.open(fname) as f:
            for record in ijson.items(f, "records.item"):
                count += 1
                lei = gleif_get(record, "LEI")
                name = gleif_get(record.get("Entity", {}), "LegalName")

                process = bool(target_leis and lei in target_leis)

                if name and not process and target_company_names:
                    name_norm = normalize_name(name)
                    for target_norm, orig_name in target_names_norm.items():
                        if target_norm == name_norm:
                            process = True
                            found_companies.add(orig_name)
                            break
                    if not process:
                        for orig_name, keywords in target_keywords.items():
                            if keywords and all(kw in name_norm for kw in keywords):
                                process = True
                                found_companies.add(orig_name)
                                break

                if process:
                    data = parse_lei2_record(record)
                    if data:
                        if data.get("sic_codes"):
                            found_sic += 1
                        if data.get("naics_codes"):
                            found_naics += 1
                        batch.append(data)
                        enriched += 1

                        if len(batch) >= BATCH_SIZE:
                            run_batch(driver, batch, UPSERT_LEI2)
                            elapsed = time.time() - start
                            rate = count / elapsed if elapsed > 0 else 0
                            pct = count / 15_000_000 * 100
                            print(f"  Scanned {count:,} ({rate:.0f} rec/s, {pct:.1f}%) | "
                                  f"Enriched {enriched:,} | Found {len(found_companies)} targets | "
                                  f"SIC:{found_sic} NAICS:{found_naics}")
                            batch = []

                if count % 500_000 == 0 and count > 0:
                    elapsed = time.time() - start
                    rate = count / elapsed if elapsed > 0 else 0
                    eta = f"~{(15_000_000 - count) / rate / 60:.0f} min" if rate > 0 else "∞"
                    print(f"  Scanned {count:,} LEI2 records ({rate:.0f} rec/s) | "
                          f"enriched {enriched:,} | found {len(found_companies)} targets | ETA: {eta}")

            if batch:
                run_batch(driver, batch, UPSERT_LEI2)
                enriched += len(batch)

    elapsed = time.time() - start
    mins = int(elapsed // 60)
    secs = int(elapsed % 60)
    print(f"\n  ✓ Scanned {count:,} LEI2 records in {mins}m {secs}s")
    print(f"  ✓ Enriched {enriched:,} Company nodes with Level 1 data")
    print(f"  ✓ SIC codes found: {found_sic} | NAICS codes found: {found_naics}")
    print(f"  ✓ Target companies found by name: {len(found_companies)}/{len(target_company_names)}")

    return {"total_scanned": count, "enriched": enriched, "found_companies": found_companies}


# ── Verification ───────────────────────────────────────────────────────


def verify_companies(driver, target_companies):
    """Query Neo4j to find each of the 100 target companies by name."""
    print("\n" + "=" * 70)
    print("PHASE: Verifying 100 target companies in Neo4j")
    print("=" * 70)

    found = []
    not_found = []

    with driver.session() as session:
        for name, country in target_companies:
            norm = normalize_name(name)
            if not norm:
                not_found.append((name, country))
                continue

            # Try exact normalized match
            result = session.run(
                "MATCH (c:Company) WHERE toLower(c.name) = $name "
                "RETURN c.lei, c.name, c.legal_address_country, "
                "c.legal_jurisdiction, c.entity_status, c.is_defense "
                "LIMIT 1",
                name=name.lower(),
            )
            rec = result.single()

            if not rec:
                # Try CONTAINS match with keywords
                keywords = [w for w in norm.split() if len(w) > 3][:3]
                if keywords:
                    kw = keywords[0]
                else:
                    kw = norm[:10]
                result = session.run(
                    "MATCH (c:Company) WHERE toLower(c.name) CONTAINS $kw "
                    "RETURN c.lei, c.name, c.legal_address_country, "
                    "c.legal_jurisdiction, c.entity_status, c.is_defense "
                    "LIMIT 5",
                    kw=kw,
                )
                rec = result.single()

            if rec:
                # Check parent/subsidiary relationships
                rel_result = session.run(
                    "MATCH (c:Company {lei: $lei})-[r:OWNED_BY_PARENT]-(parent:Company) "
                    "RETURN parent.lei AS lei, parent.name AS name, "
                    "r.relationship_type AS rtype, r.start_date AS start, "
                    "r.relationship_status AS status LIMIT 3",
                    lei=rec["c.lei"],
                )
                rels = rel_result.data()
                found.append({
                    "query": name,
                    "country": country,
                    "lei": rec["c.lei"],
                    "name": rec["c.name"],
                    "country_match": rec["c.legal_address_country"],
                    "jurisdiction": rec["c.legal_jurisdiction"],
                    "status": rec["c.entity_status"],
                    "is_defense": rec["c.is_defense"],
                    "relationships": rels,
                })
            else:
                not_found.append((name, country))

    print(f"\n  ✓ Found in Neo4j: {len(found)}/{len(target_companies)}")
    if not_found:
        print(f"  ✗ Not found: {len(not_found)}/{len(target_companies)}")

    # Print details for found companies
    print("\n  --- Found Companies ---")
    for r in found[:30]:
        print(f"  [{r['lei']}] {r['query']} → '{r['name']}'")
        if r["relationships"]:
            for rel in r["relationships"]:
                print(f"      └─ {rel.get('rtype','?')}: '{rel.get('name','?')}' ({rel.get('lei','?')})")
        if r.get("jurisdiction"):
            print(f"      Jurisdiction: {r['jurisdiction']}")
        if r.get("status"):
            print(f"      Entity Status: {r['status']}")
        if r.get("is_defense"):
            print(f"      🔴 Defense-related: True")

    if len(found) > 30:
        print(f"  ... and {len(found) - 30} more")

    if not_found:
        print("\n  --- Not Found in Database ---")
        for name, country in not_found[:20]:
            print(f"  ✗ {name} ({country})")
        if len(not_found) > 20:
            print(f"  ... and {len(not_found) - 20} more not found")

    return found, not_found


# ── Main ───────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(
        description="Comprehensive GLEIF Data Ingestion Pipeline"
    )
    parser.add_argument("--download", action="store_true", help="Download zip files")
    parser.add_argument("--verify", action="store_true", help="Verify data integrity")
    parser.add_argument("--ingest-rr", action="store_true", help="Ingest Level 2 RR data")
    parser.add_argument("--enrich-lei2", action="store_true", help="Enrich with Level 1 LEI data")
    parser.add_argument("--verify-companies", action="store_true", help="Verify 100 companies")
    parser.add_argument("--all", action="store_true", help="Run all phases")
    parser.add_argument("--target-docx", type=str, default=str(DOCX_PATH),
                        help="Path to reference .docx with 100 companies")
    args = parser.parse_args()

    if not any([args.download, args.verify, args.ingest_rr,
                args.enrich_lei2, args.verify_companies, args.all]):
        args.all = True

    load_dotenv()

    uri = os.environ["NEO4J_URI"]
    user = os.environ.get("NEO4J_USER", "neo4j")
    password = os.environ.get("NEO4J_PASSWORD", "neo4j")

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Parse target companies from reference docx
    print("Parsing reference document for target companies...")
    target_companies = parse_target_companies(Path(args.target_docx))
    print(f"  Found {len(target_companies)} target companies")
    for name, country in target_companies[:3]:
        print(f"  - {name} ({country})")
    if len(target_companies) > 3:
        print(f"  ... and {len(target_companies) - 3} more")
    target_names = [name for name, _ in target_companies]

    # Connect to Neo4j
    print(f"\nConnecting to Neo4j at {uri} ...")
    with GraphDatabase.driver(uri, auth=(user, password)) as driver:
        driver.verify_connectivity()
        print("  ✓ Connected")

        # Create schema
        driver.execute_query(CREATE_SCHEMA)
        for idx in CREATE_INDEXES:
            driver.execute_query(idx)
        print("  ✓ Schema and indexes created")

        all_leis = set()

        # Phase 0: Download
        if args.download or args.all:
            print("\n" + "=" * 70)
            print("PHASE 0: Downloading GLEIF Golden Copy datasets")
            print("=" * 70)
            print("\n  Level 1 LEI Golden Copy:")
            ensure_zip_downloaded(LEI2_URL, LEI2_ZIP)
            print("\n  Level 2 RR Golden Copy:")
            ensure_zip_downloaded(RR_URL, RR_ZIP)

        # Phase 1: Verify
        if args.verify or args.all:
            print("\n" + "=" * 70)
            print("PHASE 1: Verifying data integrity")
            print("=" * 70)
            ok1 = verify_zip(LEI2_ZIP, "records")
            ok2 = verify_zip(RR_ZIP, "relations")
            rr_json = find_rr_json()
            if rr_json.exists():
                verify_extracted_json(rr_json, "relations")
            if not ok1:
                print("  ✗ Level 1 LEI data verification failed!")
            if not ok2:
                print("  ✗ Level 2 RR data verification failed!")

        # Phase 2: Ingest Level 2 RR
        if args.ingest_rr or args.all:
            rr_json = find_rr_json()
            # Extract RR zip if not already extracted
            if not rr_json.exists() and RR_ZIP.exists():
                print("\n  Extracting RR zip...")
                with zipfile.ZipFile(RR_ZIP) as z:
                    z.extractall(DATA_DIR)
                rr_json = find_rr_json()
            all_leis = ingest_level2_rr(driver, rr_json, RR_ZIP)

        # Phase 3: Enrich with Level 1 LEI
        if args.enrich_lei2 or args.all:
            enrich_level1_lei(driver, LEI2_ZIP, all_leis, target_names)

        # Phase 4: Verify companies
        if args.verify_companies or args.all:
            found, not_found = verify_companies(driver, target_companies)

            # Summary
            total_nodes = driver.execute_query("MATCH (n) RETURN count(n) AS c").records[0]["c"]
            total_rels = driver.execute_query("MATCH ()-[r]->() RETURN count(r) AS c").records[0]["c"]
            defense_nodes = driver.execute_query(
                "MATCH (c:Company) WHERE c.is_defense = true RETURN count(c) AS c"
            ).records[0]["c"]
            total_companies = driver.execute_query(
                "MATCH (c:Company) RETURN count(c) AS c"
            ).records[0]["c"]

            print("\n" + "=" * 70)
            print("DATABASE SUMMARY")
            print("=" * 70)
            print(f"  Total nodes:        {total_nodes}")
            print(f"  Total relationships: {total_rels}")
            print(f"  Company nodes:      {total_companies}")
            print(f"  Defense companies:  {defense_nodes}")
            print(f"  Target companies found: {len(found)}/{len(target_companies)}")
            print(f"  Target companies not found: {len(not_found)}/{len(target_companies)}")

    print("\n" + "=" * 70)
    print("Pipeline complete!")
    print("=" * 70)


if __name__ == "__main__":
    main()
