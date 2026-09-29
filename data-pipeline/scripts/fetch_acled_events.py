#!/usr/bin/env python3
"""Fetch ACLED political-violence events and normalise them for review.

ACLED (Armed Conflict Location & Event Data Project) publishes coded events of
political violence with fatalities, actors and geocoded centroids. The platform
already declares a `conflict_events` table whose columns mirror the ACLED
record shape, so events normalise across without a lossy translation.

Access
------
ACLED requires a personal API key issued to an individual or institution
after they accept the ACLED Terms of Conditions. It is free for research,
media, academic and think-tank use. Registration is at

    https://acleddata.com/register/

Set ``ACLED_API_KEY`` in ``data-pipeline/.env`` before running. This script
never bypasses the key check or the licence terms.

The endpoint is paginated and rate limited; the fetcher walks pages with a
delay, records the licence alongside the data as required by ACLED's terms,
and writes a normalised payload for analyst review rather than writing
straight into the database.

Usage
-----
    ../.venv/bin/python scripts/fetch_acled_events.py --dry-run
    ../.venv/bin/python scripts/fetch_acled_events.py --year 2025
"""

from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path
from typing import Any

import requests

ACLED_API_URL = "https://acleddata.com/api/acled/read"
TIMEOUT = 120
PIPELINE_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ENV_PATH = PIPELINE_ROOT / ".env"
DEFAULT_OUTPUT = PIPELINE_ROOT / "data" / "acled_events.json"

# ACLED requires an email on every request for their abuse-monitoring.
DEFAULT_EMAIL = "research@localhost"

# Fields requested from ACLED. Keeping the list explicit documents exactly what
# the platform stores and avoids pulling payload it will not use.
REQUESTED_FIELDS = [
    "event_id",
    "event_date",
    "year",
    "event_type",
    "sub_event_type",
    "actor1",
    "actor2",
    "country",
    "region",
    "admin1",
    "admin2",
    "location",
    "latitude",
    "longitude",
    "geo_precision",
    "source",
    "notes",
    "fatalities",
    "population_exposure",
    "population_admin1",
    "population_admin2",
    "event_code",
    "iso3",
    "week",
]

SOURCE_URL = "https://acleddata.com/"


def load_env(path: Path) -> dict[str, str]:
    """Read KEY=VALUE pairs without requiring python-dotenv."""
    if not path.exists():
        return {}
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def require_key(env: dict[str, str]) -> str:
    """Return the ACLED key, or exit with registration instructions."""
    for source in (os.environ, env):
        key = source.get("ACLED_API_KEY")
        if key:
            return key
    raise SystemExit(
        "ACLED_API_KEY is not set.\n"
        "Register at https://acleddata.com/register/ using a work email\n"
        "(select Think tank, Media, Academic or NGO), accept the terms,\n"
        "then add ACLED_API_KEY to data-pipeline/.env"
    )


def fetch_page(
    key: str,
    email: str,
    year: int,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    """Request one page of ACLED events."""
    response = requests.get(
        ACLED_API_URL,
        params={
            "key": key,
            "email": email,
            "year": year,
            "page": page,
            "limit": page_size,
            "format": "json",
        },
        headers={"Accept": "application/json"},
        timeout=TIMEOUT,
    )

    if response.status_code == 401:
        raise SystemExit(
            "ACLED rejected the API key (401). Confirm the key is active and "
            "that you have accepted the ACLED terms at https://acleddata.com/."
        )
    if response.status_code == 403:
        raise SystemExit(
            "ACLED returned 403. This usually means the registered email does "
            "not match the API key, or the account is not yet approved."
        )
    if response.status_code == 429:
        raise SystemExit("ACLED rate limit reached. Wait before retrying.")

    response.raise_for_status()
    return response.json()


def to_float(value: Any) -> float | None:
    if value in (None, "", "None"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def to_int(value: Any) -> int | None:
    if value in (None, "", "None"):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def normalise(event: dict[str, Any], year: int) -> dict[str, Any]:
    """Map an ACLED event onto the `conflict_events` column shape."""
    return {
        "week": event.get("week"),
        "region": event.get("region"),
        "country": event.get("country"),
        "event_type": event.get("event_type"),
        "sub_event_type": event.get("sub_event_type"),
        "events": 1,
        "fatalities": to_int(event.get("fatalities")),
        "population_exposure": to_float(event.get("population_exposure")),
        "centroid_latitude": to_float(event.get("latitude")),
        "centroid_longitude": to_float(event.get("longitude")),
        # Retained for provenance and analyst review; the platform table has no
        # column for these, so they stay in the payload rather than being lost.
        "acled_event_id": event.get("event_id"),
        "acled_event_date": event.get("event_date"),
        "acled_event_code": event.get("event_code"),
        "actor1": event.get("actor1"),
        "actor2": event.get("actor2"),
        "admin1": event.get("admin1"),
        "admin2": event.get("admin2"),
        "location": event.get("location"),
        "geo_precision": to_int(event.get("geo_precision")),
        "iso3": event.get("iso3"),
        "acled_source": event.get("source"),
        "acled_notes": event.get("notes"),
        "acled_year": year,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--year",
        type=int,
        default=2025,
        help="Year of events to fetch (ACLED coverage runs 1997 to present).",
    )
    parser.add_argument(
        "--page-size",
        type=int,
        default=5000,
        help="Records requested per page.",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=10,
        help="Safety cap on pages, to bound a long historical run.",
    )
    parser.add_argument(
        "--country",
        action="append",
        help="Restrict to a country. Repeatable.",
    )
    parser.add_argument(
        "--email",
        default=os.environ.get("ACLED_EMAIL", DEFAULT_EMAIL),
        help="Registered ACLED email; ACLED requires it with every request.",
    )
    parser.add_argument("--env", type=Path, default=DEFAULT_ENV_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch the first page and report shape without writing.",
    )
    args = parser.parse_args()

    env = load_env(args.env)
    key = require_key(env)
    email = env.get("ACLED_EMAIL") or args.email

    print(f"ACLED fetch: year={args.year} email={email}")

    first = fetch_page(key, email, args.year, 1, args.page_size)
    data = first.get("data") or []
    total_pages = first.get("pages") or 1
    total_count = first.get("count")

    print(f"ACLED reports {total_count} events across {total_pages} pages")
    if not data:
        raise SystemExit("ACLED returned no data for that year.")

    if args.dry_run:
        print("\n--dry-run: nothing written.")
        print(f"First event: {json.dumps(data[0], indent=2)[:600]}")
        return

    events: list[dict[str, Any]] = [normalise(e, args.year) for e in data]
    for page in range(2, min(total_pages, args.max_pages) + 1):
        body = fetch_page(key, email, args.year, page, args.page_size)
        batch = body.get("data") or []
        if not batch:
            break
        events.extend(normalise(e, args.year) for e in batch)
        print(f"  page {page}/{total_pages}: {len(events):,} events")
        time.sleep(1.0)  # respect ACLED rate limits

    if args.country:
        wanted = {c.casefold() for c in args.country}
        events = [e for e in events if (e.get("country") or "").casefold() in wanted]
        print(f"Filtered to {len(args.country)} countries: {len(events):,} events")

    args.output.parent.mkdir(parents=True, exist_ok=True)

    document = {
        "source_registry_id": "acled",
        "source_url": SOURCE_URL,
        "publisher": "ACLED (Armed Conflict Location & Event Data Project)",
        "licence": "ACLED Terms of Use; free for research, media, academic and NGO use",
        "acled_terms_url": "https://acleddata.com/terms-of-use/",
        "retrieved_at": time.strftime("%Y-%m-%d"),
        "year": args.year,
        "target_table": "conflict_events",
        "record_count": len(events),
        "events": events,
    }
    args.output.write_text(json.dumps(document, indent=2, ensure_ascii=False), encoding="utf-8")

    with_fatalities = sum(1 for e in events if e.get("fatalities"))
    total_fatalities = sum(e.get("fatalities") or 0 for e in events)
    countries = len({e.get("country") for e in events if e.get("country")})

    print(f"\nWrote {len(events):,} events to {args.output}")
    print(f"Countries: {countries}   events with fatalities: {with_fatalities:,}")
    print(f"Total fatalities recorded: {total_fatalities:,}")
    print(
        "Queued, not loaded: conflict_events does not exist on the live "
        "database yet. Apply the pending migrations first, then promote via "
        "an authenticated admin session."
    )


if __name__ == "__main__":
    main()



def load_env(path: Path) -> dict[str, str]:
    """Read KEY=VALUE pairs without requiring python-dotenv."""
    if not path.exists():
        return {}
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def require_key(env: dict[str, str]) -> str:
    """Return the ACLED key, or exit with registration instructions."""
    for source in (os.environ, env):
        key = source.get("ACLED_API_KEY")
        if key:
            return key
    raise SystemExit(
        "ACLED_API_KEY is not set.\n"
        "Register at https://acleddata.com/register/ using a work email\n"
        "(select Think tank, Media, Academic or NGO), accept the terms,\n"
        "then add ACLED_API_KEY to data-pipeline/.env"
    )
