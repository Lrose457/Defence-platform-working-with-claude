#!/usr/bin/env python3
"""Quick test of parsing functions on real data."""
import sys, ijson, zipfile
sys.path.insert(0, "data-pipeline/scripts")
import ingest_gleif as ig

print("=== RR parsing test (first 3 records) ===")
with open("data-pipeline/data/20260924-0800-gleif-goldencopy-rr-golden-copy.json", "rb") as f:
    for i, record in enumerate(ijson.items(f, "relations.item", use_float=True)):
        parsed = ig.parse_rr_record(record)
        if parsed:
            print(f"  RR {i+1}: child={parsed['child_lei']}, parent={parsed['parent_lei']}, type={parsed['relationship_type']}")
        else:
            print(f"  RR {i+1}: unparseable")
            rr = record.get("RelationshipRecord", record)
            rel = rr.get("Relationship", rr)
            print(f"    rel keys: {list(rel.keys())}")
            print(f"    start: {rel.get('StartNode', {})}")
            print(f"    end: {rel.get('EndNode', {})}")
        if i >= 2:
            break

print("\n=== LEI2 parsing test (first 3 records) ===")
with zipfile.ZipFile("data-pipeline/data/lei2_latest.json.zip") as z:
    fname = z.namelist()[0]
    with z.open(fname) as f:
        for i, record in enumerate(ijson.items(f, "records.item", use_float=True)):
            parsed = ig.parse_lei2_record(record)
            if parsed:
                print(f"  LEI2 {i+1}: lei={parsed['lei']}, name={parsed['name']}")
                print(f"    country={parsed['legal_address_country']}, status={parsed['entity_status']}")
                print(f"    sic={parsed['sic_codes']}, naics={parsed['naics_codes']}, defense={parsed['is_defense']}")
            if i >= 2:
                break

print("\n✓ Test complete")