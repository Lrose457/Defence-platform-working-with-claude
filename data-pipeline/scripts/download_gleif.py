"""Stream GLEIF Level 2 relationship records into Neo4j."""

from __future__ import annotations

import argparse
import os
from collections.abc import Iterator, Mapping, Sequence
from typing import Any

import ijson
import requests
from dotenv import load_dotenv
from neo4j import Driver, GraphDatabase

DEFAULT_GLEIF_URL = (
    "https://goldencopy.gleif.org/lei-data/gleif-golden-copy/relationship-records.json"
)
BATCH_SIZE = 5_000
REQUEST_TIMEOUT = 120

DEFENSE_KEYWORDS = (
    "defense",
    "defence",
    "aerospace",
    "munitions",
    "armament",
    "tactical",
    "military",
    "missile",
    "shipbuilding",
    "lockheed",
    "raytheon",
    "rheinmetall",
    "thales",
    "baesystems",
    "norinco",
)

CREATE_SCHEMA = """
CREATE CONSTRAINT company_lei_unique IF NOT EXISTS
FOR (company:Company)
REQUIRE company.lei IS UNIQUE
"""

UPSERT_BATCH = """
UNWIND $rows AS row
MERGE (child:Company {lei: row.child_lei})
SET child.name = row.child_name,
    child.is_defense = coalesce(child.is_defense, false) OR row.child_is_defense
MERGE (parent:Company {lei: row.parent_lei})
SET parent.name = row.parent_name,
    parent.is_defense = coalesce(parent.is_defense, false) OR row.parent_is_defense
MERGE (child)-[:OWNED_BY_PARENT]->(parent)
"""


def is_defense_related(company_name: str) -> bool:
    """Return whether a company name matches a defense-sector keyword."""
    normalized_name = company_name.casefold()
    return any(keyword in normalized_name for keyword in DEFENSE_KEYWORDS)


def _value_at(record: Mapping[str, Any], paths: Sequence[Sequence[str]]) -> str | None:
    for path in paths:
        value: Any = record
        for key in path:
            if not isinstance(value, Mapping):
                value = None
                break
            value = value.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _entity_details(record: Mapping[str, Any], role: str) -> tuple[str | None, str | None]:
    """Read a relationship endpoint from the common GLEIF JSON representations."""
    entity = record.get(role)
    if not isinstance(entity, Mapping):
        entity = {}

    lei_paths = (
        ("NodeID",),
        ("Entity", "LEI"),
        ("LEI",),
    )
    name_paths = (
        ("LegalName", "Name"),
        ("Entity", "LegalName", "Name"),
        ("Name",),
    )
    lei = _value_at(entity, lei_paths) or _value_at(record, ((role, "LEI"),))
    name = _value_at(entity, name_paths)
    return lei, name


def _relationship_row(record: Mapping[str, Any]) -> dict[str, Any] | None:
    relationship = record.get("Relationship")
    if not isinstance(relationship, Mapping):
        relationship = record

    child, child_name = _entity_details(relationship, "StartNode")
    parent, parent_name = _entity_details(relationship, "EndNode")

    if not child or not parent:
        child = child or _value_at(record, (("ChildEntity", "LEI"), ("Child", "LEI")))
        parent = parent or _value_at(record, (("ParentEntity", "LEI"), ("Parent", "LEI")))
        child_name = child_name or _value_at(
            record,
            (("ChildEntity", "LegalName", "Name"), ("Child", "LegalName", "Name")),
        )
        parent_name = parent_name or _value_at(
            record,
            (("ParentEntity", "LegalName", "Name"), ("Parent", "LegalName", "Name")),
        )

    if not child or not parent:
        return None

    child_name = child_name or child
    parent_name = parent_name or parent
    return {
        "child_lei": child,
        "child_name": child_name,
        "child_is_defense": is_defense_related(child_name),
        "parent_lei": parent,
        "parent_name": parent_name,
        "parent_is_defense": is_defense_related(parent_name),
    }


def stream_relationships(response: requests.Response) -> Iterator[dict[str, Any]]:
    """Yield normalized relationship rows without loading the JSON document."""
    for record in ijson.items(response.raw, "item"):
        if not isinstance(record, Mapping):
            continue
        row = _relationship_row(record)
        if row:
            yield row


def ingest_batch(driver: Driver, rows: list[dict[str, Any]]) -> None:
    with driver.session() as session:
        session.execute_write(lambda transaction: transaction.run(UPSERT_BATCH, rows=rows).consume())


def download_and_ingest(driver: Driver, url: str) -> int:
    imported = 0
    batch: list[dict[str, Any]] = []

    with requests.get(url, stream=True, timeout=REQUEST_TIMEOUT) as response:
        response.raise_for_status()
        for row in stream_relationships(response):
            batch.append(row)
            if len(batch) == BATCH_SIZE:
                ingest_batch(driver, batch)
                imported += len(batch)
                print(f"Imported {imported:,} relationship records")
                batch = []

    if batch:
        ingest_batch(driver, batch)
        imported += len(batch)

    return imported


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--url",
        default=os.getenv("GLEIF_RELATIONSHIP_URL", DEFAULT_GLEIF_URL),
        help="GLEIF relationship-records JSON URL",
    )
    return parser.parse_args()


def main() -> None:
    load_dotenv()
    args = parse_args()

    uri = os.environ["NEO4J_URI"]
    user = os.environ["NEO4J_USER"]
    password = os.environ["NEO4J_PASSWORD"]

    with GraphDatabase.driver(uri, auth=(user, password)) as driver:
        driver.verify_connectivity()
        driver.execute_query(CREATE_SCHEMA)
        imported = download_and_ingest(driver, args.url)

    print(f"Finished: imported {imported:,} relationship records")


if __name__ == "__main__":
    main()
