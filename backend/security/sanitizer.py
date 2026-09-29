"""Sanitize untrusted scraped content before persistence or rendering."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from html import escape
from typing import Any


def sanitize_text(value: str) -> str:
    """Escape all HTML syntax and quotes in untrusted text."""
    if not isinstance(value, str):
        raise TypeError("sanitize_text expects a string")
    return escape(value, quote=True)


def sanitize_data(value: Any) -> Any:
    """Recursively escape strings in scraped mappings and sequences."""
    if isinstance(value, str):
        return sanitize_text(value)
    if isinstance(value, Mapping):
        return {key: sanitize_data(item) for key, item in value.items()}
    if isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray)):
        return [sanitize_data(item) for item in value]
    return value
