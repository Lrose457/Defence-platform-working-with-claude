#!/usr/bin/env python3
"""Harvester: European public-broadcaster newsfeeds -> hybrid-warfare incident
candidates, classified by the rules engine in `hybrid_classification`.

Each RSS item is classified; anything that is NOT `not_hybrid` becomes a
candidate record in the `possible` bucket and is emitted as replay JSON for
`POST /api/intelligence/ingestion`. Records are idempotent via `external_id`
(source URL hash) so re-runs upsert cleanly. Geolocation is not emitted here
(broadcaster feeds rarely carry geocoords); the atlas layer places incidents at
the attacked country's centroid from `attacked_iso3`.

Feeds are all freely available, public RSS endpoints operated by the listed
European public broadcasters (BBC, Deutsche Welle, France 24, ARD, ZDF, SVT).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dip_common import add_common_args, make_record, replay_footer, slugify, utc_now_iso, write_replay
from hybrid_classification import Classification, classify

USER_AGENT = "dip-hybrid-harvester/1.0 (+defence-platform; rss-harvest)"
TIMEOUT_S = 25

# (broadcaster, public RSS feed URL)
HARVEST_FEEDS: list[tuple[str, str]] = [
    ("BBC News World", "http://feeds.bbci.co.uk/news/world/rss.xml"),
    ("BBC News UK", "http://feeds.bbci.co.uk/news/uk/rss.xml"),
    ("BBC News Europe", "http://feeds.bbci.co.uk/news/world-europe/rss.xml"),
    ("Deutsche Welle English", "https://rss.dw.com/feed-topics-193300-l-en.xml"),
    ("Deutsche Welle German", "https://rss.dw.com/feed-topics-1454-rss-c-19786071-l-de.xml"),
    ("Deutsche Welle Arabic", "https://rss.dw.com/feed-topics-3235-l-ar.xml"),
    ("Deutsche Welle Spanish", "https://rss.dw.com/feed-topics-193300-l-es.xml"),
    ("France 24 Europe", "https://www.france24.com/en/europe/rss/"),
    ("France 24 International", "https://www.france24.com/en/international/rss/"),
    ("France 24 Arabic", "https://www.france24.com/ar/rss/"),
    ("France 24 French", "https://www.france24.com/fr/rss/"),
    ("France 24 Spanish", "https://www.france24.com/es/rss/"),
    ("ARD Tagesschau", "https://www.tagesschau.de/aktuell/2-101/rss-101"),
    ("ZDF Heute", "https://www.zdf.de/nachrichten/rss-alles.xml"),
    ("SVT Nyheter", "https://www.svt.se/rss.xml"),
]

_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(value: str | None) -> str:
    if not value:
        return ""
    return _TAG_RE.sub(" ", value).strip()


def _clean(value: str | None) -> str:
    return " ".join((value or "").split())


def _fetch(url: str) -> tuple[str | None, str | None]:
    """Return (xml, None) on success or (None, error) on failure.

    Distinguishing the two lets the stats writer separate "feed is dead"
    from "feed fetched fine but yielded no candidates" — the nightly cron
    opens an issue on the former, never on the latter.
    """
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            return resp.read().decode("utf-8", errors="replace"), None
    except Exception as exc:  # noqa: BLE001 - one bad feed must not kill the run
        return None, str(exc)


def _iter_items(rss_xml: str) -> list[dict[str, str]]:
    """Pull {title,link,description,guid} per <item>, namespace-agnostic."""
    try:
        root = ET.fromstring(rss_xml)
    except ET.ParseError:
        return []
    items: list[dict[str, str]] = []
    for node in root.iter():
        if not node.tag.endswith("item"):
            continue
        entry: dict[str, str] = {}
        for child in node:
            tag = child.tag.split("}")[-1].lower()
            if tag in ("title", "link", "description", "guid"):
                entry.setdefault(tag, _clean(child.text))
        if entry.get("title") or entry.get("description"):
            items.append(entry)
    return items


def _external_id(broadcaster: str, link: str | None, title: str) -> str:
    seed = (link or title).encode("utf-8", errors="ignore")
    return f"hw-{slugify(broadcaster)}-{hashlib.md5(seed).hexdigest()[:10]}"


def _evidence_urls(item: dict[str, str]) -> list[str]:
    urls: list[str] = []
    for key in ("link", "guid"):
        val = (item.get(key) or "").strip()
        # RSS guids are often bare ids, not links — only real URLs belong
        # in the evidence list.
        if val.startswith(("http://", "https://")) and val not in urls:
            urls.append(val)
    return urls


def shape_record(item: dict[str, str], broadcaster: str,
                 classify_fn=classify) -> dict[str, Any] | None:
    """Pure helper: turn one parsed RSS item into a replay record, or None.

    Testable offline with a fake classify_fn.
    """
    title = _clean(item.get("title") or "")
    description = _strip_html(item.get("description") or "")
    body = f"{title} {description}"
    if not body.strip():
        return None
    classification: Classification = classify_fn(description, title=title)
    if classification.label == "not_hybrid":
        return None

    payload: dict[str, Any] = {
        "title": title or None,
        "attacked_iso3": classification.attacked_iso3,
        "target_type": classification.target_type,
        "lat": None,
        "lng": None,
        "summary": classification.summary,
        "definition_clause": classification.definition_clause,
        "domains": classification.domains,
        "evidence_urls": _evidence_urls(item),
        "corroboration_count": 0,
        "target_description": description[:500],
        "classification_label": classification.label,
        "confidence_band": "possible",
    }
    rec = make_record(
        entity_type="hybrid_warfare_incident",
        title=title or broadcaster,
        external_id=_external_id(broadcaster, item.get("link"), title),
        normalised_payload=payload,
        source_url=item.get("link"),
        retrieved_at=datetime.now(timezone.utc).isoformat(),
        verification_status="needs_review",
        data_confidence="single_source",
        confidence_score=classification.confidence_score,
        source_registry_id=f"broadcaster:{broadcaster}",
    )
    return rec


def harvest_feed(url: str, broadcaster: str,
                 classify_fn=classify, limit: int = 0
                 ) -> tuple[list[dict[str, Any]], str | None]:
    """Fetch and classify one feed.

    Returns (records, error): error is None after a successful fetch (even
    if the feed yielded zero candidates), non-None when the feed could not
    be fetched at all.
    """
    xml_text, err = _fetch(url)
    if err is not None:
        print(f"  ! feed fetch failed: {url} -> {err}")
        return [], err
    items = _iter_items(xml_text or "")
    if limit:
        items = items[:limit]
    records: list[dict[str, Any]] = []
    for item in items:
        rec = shape_record(item, broadcaster, classify_fn=classify_fn)
        if rec is not None:
            records.append(rec)
    return records, None


def harvest_one(url: str, broadcaster: str,
                classify_fn=classify, limit: int = 0) -> list[dict[str, Any]]:
    """Records-only wrapper around harvest_feed (fetch errors swallowed)."""
    return harvest_feed(url, broadcaster, classify_fn=classify_fn, limit=limit)[0]


def build_stats(feed_results: list[dict[str, Any]],
                records: list[dict[str, Any]],
                generated_at: str | None = None) -> dict[str, Any]:
    """Machine-readable run summary for the nightly cron (pure function).

    `feed_results` entries carry {broadcaster, url, error, candidates} —
    error is null when the fetch succeeded.
    """
    failed = [f for f in feed_results if f.get("error")]
    labels: dict[str, int] = {}
    for rec in records:
        label = rec["normalised_payload"].get("classification_label") or "unknown"
        labels[label] = labels.get(label, 0) + 1
    return {
        "generated_at": generated_at or utc_now_iso(),
        "feeds_attempted": len(feed_results),
        "feeds_ok": len(feed_results) - len(failed),
        "feeds_failed": [
            {"broadcaster": f["broadcaster"], "url": f["url"], "error": f["error"]}
            for f in failed
        ],
        "candidates": len(records),
        "labels": labels,
        "by_feed": [
            {"broadcaster": f["broadcaster"], "candidates": f.get("candidates", 0)}
            for f in feed_results
        ],
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Harvest hybrid-warfare candidates from EMEA public broadcasters.")
    add_common_args(p, default_output="hybrid_warfare_replay.json")
    p.add_argument("--feeds", nargs="*", help="Limit to a subset of feed names.")
    p.add_argument("--stats", type=Path, default=None,
                   help="Also write a machine-readable run summary (JSON) "
                        "for automation (nightly cron, monitoring).")
    args = p.parse_args(argv)

    feeds = HARVEST_FEEDS
    if getattr(args, "feeds", None):
        feeds = [f for f in feeds if f[0] in args.feeds]

    total = 0
    all_records: list[dict[str, Any]] = []
    feed_results: list[dict[str, Any]] = []
    for broadcaster, url in feeds:
        print(f"  . harvesting {broadcaster}: {url}")
        recs, err = harvest_feed(url, broadcaster, limit=args.limit)
        all_records.extend(recs)
        total += len(recs)
        feed_results.append({
            "broadcaster": broadcaster,
            "url": url,
            "error": err,
            "candidates": len(recs),
        })

    n = write_replay(all_records, Path(args.output))
    replay_footer(Path(args.output), n)
    print(f"  candidate incidents: {total}")

    if args.stats:
        stats = build_stats(feed_results, all_records)
        args.stats.parent.mkdir(parents=True, exist_ok=True)
        args.stats.write_text(json.dumps(stats, indent=2, ensure_ascii=False),
                              encoding="utf-8")
        print(f"  stats: {stats['feeds_ok']}/{stats['feeds_attempted']} feeds ok, "
              f"failed={len(stats['feeds_failed'])}, candidates={n} -> {args.stats}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
