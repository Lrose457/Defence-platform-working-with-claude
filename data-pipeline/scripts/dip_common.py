#!/usr/bin/env python3
"""Shared helpers for the DIP data pipeline.

Contract (mirrors ingest_hiik_conflicts.py): never write to Supabase
directly -- emit replay JSON for POST /api/intelligence/ingestion.
Confidence is 0-100; verification_status in unverified/needs_review/
verified/rejected; unknowns stay null with a source_limitation note.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PIPELINE_ROOT / "data"
VALID_VERIFICATION = {"unverified", "needs_review", "verified", "rejected"}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean(value: Any) -> str | None:
    if value is None:
        return None
    s = " ".join(str(value).split())
    return s or None


def slugify(value: str, max_len: int = 60) -> str:
    folded = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return (re.sub(r"[^a-z0-9]+", "-", folded.casefold()).strip("-")[:max_len] or "record")


def clamp_conf(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return max(0, min(100, int(value)))
    except (TypeError, ValueError):
        return None


def make_record(*, entity_type: str, title: str, external_id: str,
                normalised_payload: dict[str, Any], source_url: str | None = None,
                raw_payload: Any = None, operation: str = "insert",
                entity_id: int | None = None, verification_status: str = "unverified",
                data_confidence: str = "single_source", confidence_score: int | None = 70,
                source_registry_id: str | None = None,
                retrieved_at: str | None = None) -> dict[str, Any]:
    if verification_status not in VALID_VERIFICATION:
        raise ValueError(f"bad verification_status: {verification_status!r}")
    payload = dict(normalised_payload)
    if source_registry_id and "source_registry_id" not in payload:
        payload["source_registry_id"] = source_registry_id
    return {"entity_type": entity_type, "entity_id": entity_id, "operation": operation,
            "title": clean(title) or title, "external_id": external_id,
            "normalised_payload": payload, "raw_payload": raw_payload,
            "source_url": source_url, "retrieved_at": retrieved_at or utc_now_iso(),
            "verification_status": verification_status, "data_confidence": data_confidence,
            "confidence_score": clamp_conf(confidence_score)}


def write_replay(records: list[dict[str, Any]], output: Path) -> int:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")
    return len(records)


def add_common_args(p: argparse.ArgumentParser, default_output: str) -> None:
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--output", type=Path, default=DATA_DIR / default_output)
    p.add_argument("--limit", type=int, default=0)


def replay_footer(output: Path, n: int) -> None:
    print(f"\nWrote {n} records to {output}\nReplay via POST /api/intelligence/ingestion (admin), approve in /admin/ingestion.")


_SUFFIX = re.compile(r"\b(inc|incorporated|corp|corporation|ltd|limited|plc|gmbh|sarl|srl|sas|sl|spa|s\.p\.a\.|ab|oy|as|asa|nv|bv|pty|pte|llc|llp|co|company|group|holding|holdings|defence|defense|space|systems|technologies|technology|aerospace|and|the|of|for|de|la|et|und)\b\.?", re.I)


def canonical_company_name(name: str) -> str:
    folded = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii").lower()
    return " ".join(re.sub(r"[^a-z0-9]+", " ", _SUFFIX.sub(" ", folded)).split())


def trigram_sim(a: str, b: str) -> float:
    sa = {f"  {a}  "[i:i+3] for i in range(len(a) + 2)}
    sb = {f"  {b}  "[i:i+3] for i in range(len(b) + 2)}
    if not sa or not sb:
        return 0.0
    return 2 * len(sa & sb) / (len(sa) + len(sb))


def name_similarity(a: str, b: str) -> float:
    ca, cb = canonical_company_name(a), canonical_company_name(b)
    if not ca or not cb:
        return 0.0
    if ca == cb:
        return 1.0
    # Token-set overlap catches "airbus" inside "airbus ds geo".
    ta, tb = set(ca.split()), set(cb.split())
    if ta and tb and (ta <= tb or tb <= ta):
        return 0.95
    inter = len(ta & tb)
    if inter:
        overlap = 2 * inter / (len(ta) + len(tb))
        if overlap >= 0.5:
            return max(0.85, overlap)
    try:
        from rapidfuzz import fuzz  # type: ignore
        return float(fuzz.token_set_ratio(ca, cb)) / 100.0
    except ImportError:
        return trigram_sim(ca, cb)
