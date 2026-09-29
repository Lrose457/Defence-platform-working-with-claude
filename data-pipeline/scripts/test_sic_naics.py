#!/usr/bin/env python3
"""Quick test: check SIC/NAICS availability in LEI2 data."""
import zipfile
import ijson

zippath = "data-pipeline/data/lei2_latest.json.zip"
sic_entity = naics_entity = sic_ext = naics_ext = 0
first_entity_keys = None
first_record = None

with zipfile.ZipFile(zippath) as z:
    fname = z.namelist()[0]
    with z.open(fname) as f:
        for i, record in enumerate(ijson.items(f, "records.item")):
            if i == 0:
                entity = record.get("Entity", {})
                first_entity_keys = list(entity.keys())
                first_record = record
            entity = record.get("Entity", {})
            ext = record.get("Extension") or {}
            if entity.get("SICCodes"):
                sic_entity += 1
            if entity.get("NAICS"):
                naics_entity += 1
            if ext.get("SICCodes"):
                sic_ext += 1
            if ext.get("NAICS"):
                naics_ext += 1
            if i >= 9999:
                break

print(f"First 10K LEI2 records:")
print(f"  Entity keys: {first_entity_keys}")
print(f"  Entity.SICCodes: {sic_entity}")
print(f"  Entity.NAICS: {naics_entity}")
print(f"  Extension.SICCodes: {sic_ext}")
print(f"  Extension.NAICS: {naics_ext}")
print(f"  Has Extension: {'Extension' in first_record}")