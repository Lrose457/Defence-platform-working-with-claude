"""Download public source datasets into a provenance-preserving local cache.

This runner only downloads public files. It does not bypass API keys, licences,
robots rules, or publisher terms. Each output record keeps its source registry
ID, URL, retrieval date, and raw payload for later review/import.
"""

from __future__ import annotations

import argparse
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

TIMEOUT = 120
DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "public_sources"

PUBLIC_SOURCES = {
    "ofac": {
        "url": "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML",
        "format": "ofac_xml",
    },
    "un-sanctions": {
        "url": "https://scsanctions.un.org/resources/xml/en/consolidated.xml",
        "format": "un_xml",
    },
    "uk-sanctions": {
        "url": "https://www.gov.uk/government/publications/the-uk-sanctions-list",
        "format": "uk_publication",
    },
}


def retrieved_at() -> str:
    return datetime.now(timezone.utc).isoformat()


def text(element: ET.Element | None) -> str | None:
    if element is None:
        return None
    value = " ".join("".join(element.itertext()).split())
    return value or None


def child(element: ET.Element, name: str) -> ET.Element | None:
    return element.find(f"{{*}}{name}")


def parse_ofac(payload: bytes, source_url: str) -> list[dict[str, Any]]:
    root = ET.fromstring(payload)
    records: list[dict[str, Any]] = []
    for item in root.findall(".//{*}sdnEntry"):
        name = text(child(item, "lastName")) or text(child(item, "firstName")) or "Unknown"
        aliases = [text(child(alias, "lastName")) for alias in item.findall("./{*}akaList/{*}aka")]
        records.append(
            {
                "entity_type": "sanctioned_entity",
                "name": name,
                "aliases": [alias for alias in aliases if alias],
                "programs": [text(program) for program in item.findall("./{*}programList/{*}program")],
                "country": text(item.find("./{*}addressList/{*}address/{*}country")),
                "source_registry_id": "ofac",
                "source_url": source_url,
                "retrieved_at": retrieved_at(),
                "raw_payload": ET.tostring(item, encoding="unicode"),
            }
        )
    return records


def parse_un(payload: bytes, source_url: str) -> list[dict[str, Any]]:
    root = ET.fromstring(payload)
    records: list[dict[str, Any]] = []
    for tag, entity_type in (("INDIVIDUAL", "sanctioned_person"), ("ENTITY", "sanctioned_entity")):
        for item in root.findall(f".//{tag}"):
            name = text(item.find("FIRST_NAME")) or text(item.find("NAME")) or "Unknown"
            if text(item.find("SECOND_NAME")):
                name = f"{name} {text(item.find('SECOND_NAME'))}"
            records.append(
                {
                    "entity_type": entity_type,
                    "name": name,
                    "aliases": [text(alias) for alias in item.findall("./INDIVIDUAL_ALIAS/ALIAS_NAME") if text(alias)],
                    "country": text(item.find("./INDIVIDUAL_ADDRESS/COUNTRY")) or text(item.find("./ENTITY_ADDRESS/COUNTRY")),
                    "source_registry_id": "un-sanctions",
                    "source_url": source_url,
                    "retrieved_at": retrieved_at(),
                    "raw_payload": ET.tostring(item, encoding="unicode"),
                }
            )
    return records


def discover_uk_links(html: bytes, source_url: str) -> list[dict[str, Any]]:
    links = sorted(set(re.findall(rb'href=["\']([^"\']+\.(?:csv|xml|zip))["\']', html, re.I)))
    return [
        {
            "entity_type": "source_download",
            "download_url": link.decode("utf-8", errors="replace"),
            "source_registry_id": "uk-sanctions",
            "source_url": source_url,
            "retrieved_at": retrieved_at(),
        }
        for link in links
    ]


def fetch_source(source_id: str) -> list[dict[str, Any]]:
    config = PUBLIC_SOURCES[source_id]
    response = requests.get(config["url"], timeout=TIMEOUT)
    response.raise_for_status()
    if config["format"] == "ofac_xml":
        return parse_ofac(response.content, config["url"])
    if config["format"] == "un_xml":
        return parse_un(response.content, config["url"])
    return discover_uk_links(response.content, config["url"])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", choices=[*PUBLIC_SOURCES, "all"], default="all")
    parser.add_argument("--output", type=Path, default=DATA_DIR / "public_source_records.json")
    args = parser.parse_args()

    source_ids = list(PUBLIC_SOURCES) if args.source == "all" else [args.source]
    records: list[dict[str, Any]] = []
    for source_id in source_ids:
        try:
            source_records = fetch_source(source_id)
            records.extend(source_records)
            print(f"{source_id}: {len(source_records):,} records")
        except (requests.RequestException, ET.ParseError) as error:
            print(f"{source_id}: skipped ({error})")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(f"Wrote {len(records):,} public source records to {args.output}")


if __name__ == "__main__":
    main()