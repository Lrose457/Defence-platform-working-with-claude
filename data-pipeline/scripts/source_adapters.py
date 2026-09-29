#!/usr/bin/env python3
"""Credentialed-source adapter scaffolding for the defence-intelligence platform.

The project already tracks the required credential names in the source registry and
sample env file. This module turns those registry entries into a consistent, safe
adapter layer that can be used by future ingestion jobs without hard-coding
vendor-specific logic into the application itself.

The functions here intentionally validate credentials before performing any network
call and normalise payloads into the same record format used by the public
fetchers.
"""

from __future__ import annotations

import os
from typing import Any, Iterable, Mapping
from urllib.parse import urljoin

import requests


SOURCE_ENV_VARS = {
    "opensanctions": ("OPENSANCTIONS_API_KEY",),
    "opencorporates": ("OPENCORPORATES_API_KEY",),
    "companies-house": ("COMPANIES_HOUSE_API_KEY",),
    "acled": ("ACLED_API_KEY",),
    "flightradar24": ("FLIGHTRADAR24_API_KEY",),
    "marinetraffic": ("MARINETRAFFIC_API_KEY",),
    "vesselfinder": ("VESSELFINDER_API_KEY",),
    "iiss": ("IISS_API_KEY", "IISS_SUBSCRIPTION"),
    "janes": ("JANES_API_KEY",),
}

DEFAULT_BASE_URLS = {
    "opensanctions": "https://api.opensanctions.org/",
    "opencorporates": "https://api.opencorporates.com/",
    "companies-house": "https://api.company-information.service.gov.uk/",
    "acled": "https://api.acleddata.com/",
    "flightradar24": "https://api.flightradar24.com/",
    "marinetraffic": "https://services.marinetraffic.com/",
    "vesselfinder": "https://api.vesselfinder.com/",
    "iiss": "https://www.iiss.org/",
    "janes": "https://api.janes.com/",
}


def required_env_vars(source_id: str) -> tuple[str, ...]:
    """Return the required credential variable names for a source."""
    env_vars = SOURCE_ENV_VARS.get(source_id)
    if env_vars is None:
        raise ValueError(f"Unknown source adapter: {source_id}")
    return env_vars


def validate_source_credentials(source_id: str) -> dict[str, str]:
    """Validate that all credential values required by a source are present."""
    credentials: dict[str, str] = {}
    missing: list[str] = []

    for env_var in required_env_vars(source_id):
        value = os.getenv(env_var)
        if value:
            credentials[env_var] = value
        else:
            missing.append(env_var)

    if missing:
        missing_text = ", ".join(missing)
        raise ValueError(
            f"Missing required environment variable(s) for {source_id}: {missing_text}"
        )

    return credentials


def normalise_records(payload: Any) -> list[dict[str, Any]]:
    """Coerce a vendor payload into a list of dictionaries."""
    if payload is None:
        return []

    if isinstance(payload, list):
        items = payload
    elif isinstance(payload, dict):
        for key in ("results", "data", "records", "items", "entities", "matches"):
            value = payload.get(key)
            if isinstance(value, list):
                items = value
                break
        else:
            items = [payload]
    else:
        items = [{"value": payload}]

    normalised: list[dict[str, Any]] = []
    for item in items:
        if isinstance(item, Mapping):
            normalised.append(dict(item))
        else:
            normalised.append({"value": item})
    return normalised


def source_base_url(source_id: str) -> str:
    """Return a base URL for a source, allowing environment override."""
    env_name = f"{source_id.upper().replace('-', '_')}_API_BASE_URL"
    configured = os.getenv(env_name)
    if configured:
        return configured.rstrip("/") + "/"
    return DEFAULT_BASE_URLS.get(source_id, "")


def request_json(
    *,
    url: str,
    headers: dict[str, str] | None = None,
    params: Mapping[str, Any] | None = None,
    timeout: int = 60,
) -> Any:
    response = requests.get(url, headers=headers or {}, params=dict(params or {}), timeout=timeout)
    response.raise_for_status()
    return response.json()


def fetch_opensanctions(*, query: str = "", limit: int = 25) -> list[dict[str, Any]]:
    """Fetch OpenSanctions records using the configured API key."""
    credentials = validate_source_credentials("opensanctions")
    base_url = source_base_url("opensanctions")
    endpoint = urljoin(base_url, "entities/")
    headers = {
        "Authorization": f"Token {credentials['OPENSANCTIONS_API_KEY']}",
        "Accept": "application/json",
    }
    params: dict[str, Any] = {"limit": limit}
    if query:
        params["q"] = query
    payload = request_json(url=endpoint, headers=headers, params=params)
    return normalise_records(payload)


def fetch_opencorporates(*, q: str = "", limit: int = 25) -> list[dict[str, Any]]:
    """Fetch OpenCorporates search results using the configured API key."""
    credentials = validate_source_credentials("opencorporates")
    base_url = source_base_url("opencorporates")
    endpoint = urljoin(base_url, "v0.4.8/companies/search")
    params: dict[str, Any] = {"api_token": credentials["OPENCORPORATES_API_KEY"], "limit": limit}
    if q:
        params["q"] = q
    payload = request_json(url=endpoint, params=params)
    return normalise_records(payload)


def fetch_companies_house(*, q: str = "", limit: int = 25) -> list[dict[str, Any]]:
    """Fetch Companies House records using the configured API key."""
    credentials = validate_source_credentials("companies-house")
    base_url = source_base_url("companies-house")
    endpoint = urljoin(base_url, "search/companies")
    headers = {
        "Authorization": credentials["COMPANIES_HOUSE_API_KEY"],
        "Accept": "application/json",
    }
    params: dict[str, Any] = {"items_per_page": limit}
    if q:
        params["q"] = q
    payload = request_json(url=endpoint, headers=headers, params=params)
    return normalise_records(payload)


def fetch_acled(*, limit: int = 25, country: str | None = None) -> list[dict[str, Any]]:
    """Fetch ACLED event records using the configured API key."""
    credentials = validate_source_credentials("acled")
    base_url = source_base_url("acled")
    endpoint = urljoin(base_url, "acled/read")
    headers = {"Accept": "application/json"}
    params: dict[str, Any] = {
        "key": credentials["ACLED_API_KEY"],
        "limit": limit,
    }
    if country:
        params["country"] = country
    payload = request_json(url=endpoint, headers=headers, params=params)
    return normalise_records(payload)


def fetch_source_records(source_id: str, **kwargs: Any) -> list[dict[str, Any]]:
    """Dispatch to the correct source-specific adapter by registry ID."""
    adapters = {
        "opensanctions": fetch_opensanctions,
        "opencorporates": fetch_opencorporates,
        "companies-house": fetch_companies_house,
        "acled": fetch_acled,
    }

    adapter = adapters.get(source_id)
    if adapter is None:
        raise ValueError(f"No adapter available for source_id={source_id!r}")

    return adapter(**kwargs)


if __name__ == "__main__":
    print("Available adapters:", ", ".join(sorted(SOURCE_ENV_VARS)))
