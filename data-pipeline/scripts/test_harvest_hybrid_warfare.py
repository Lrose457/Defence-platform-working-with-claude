"""Tests for the hybrid-warfare harvester's pure helpers (no network).

Covers `build_stats` (the machine-readable run summary the nightly cron
consumes) and `shape_record` (the replay-record contract), using a fake
classifier so nothing touches the network.
"""

from __future__ import annotations

from hybrid_classification import Classification
from harvest_hybrid_warfare import build_stats, shape_record


def _fake_classifier(label: str):
    def fn(text: str, title: str = "") -> Classification:
        return Classification(
            label=label,
            confidence_score=55,
            target_type=None,
            attacked_iso3=None,
            summary="s",
            definition_clause="d",
            domains=["military"],
        )
    return fn


def test_build_stats_aggregates_feeds_and_candidates():
    feed_results = [
        {"broadcaster": "A", "url": "http://a", "error": None, "candidates": 3},
        {"broadcaster": "B", "url": "http://b", "error": "HTTP Error 404", "candidates": 0},
        {"broadcaster": "C", "url": "http://c", "error": None, "candidates": 0},
    ]
    records = [
        {"normalised_payload": {"classification_label": "possible_hybrid_warfare"}},
        {"normalised_payload": {"classification_label": "needs_review"}},
        {"normalised_payload": {"classification_label": "needs_review"}},
    ]
    stats = build_stats(feed_results, records, generated_at="2026-10-06T00:00:00+00:00")

    assert stats["generated_at"] == "2026-10-06T00:00:00+00:00"
    assert stats["feeds_attempted"] == 3
    assert stats["feeds_ok"] == 2
    # The cron keys its issue off this list — a dead feed must be reported
    # even when other feeds still work.
    assert stats["feeds_failed"] == [
        {"broadcaster": "B", "url": "http://b", "error": "HTTP Error 404"},
    ]
    assert stats["candidates"] == 3
    assert stats["labels"] == {"possible_hybrid_warfare": 1, "needs_review": 2}
    # An empty-but-successful feed is NOT a failure (candidates=0, absent
    # from feeds_failed) — quiet feeds must not open issues.
    assert [f["broadcaster"] for f in stats["by_feed"]] == ["A", "B", "C"]
    assert stats["by_feed"][2]["candidates"] == 0


def test_build_stats_happy_path_has_no_failures():
    stats = build_stats(
        [{"broadcaster": "A", "url": "http://a", "error": None, "candidates": 1}],
        [{"normalised_payload": {}}],
        generated_at="x",
    )
    assert stats["feeds_failed"] == []
    assert stats["labels"] == {"unknown": 1}


def test_shape_record_emits_replay_contract_for_queued_labels():
    item = {
        "title": "Drone strike and disinformation target grid",
        "link": "https://example.org/a",
        "description": "<p>Body text</p>",
        "guid": "g1",
    }
    rec = shape_record(item, "Test Broadcaster",
                       classify_fn=_fake_classifier("possible_hybrid_warfare"))
    assert rec is not None
    assert rec["entity_type"] == "hybrid_warfare_incident"
    assert rec["verification_status"] == "needs_review"
    assert rec["normalised_payload"]["confidence_band"] == "possible"
    assert rec["normalised_payload"]["classification_label"] == "possible_hybrid_warfare"
    assert rec["normalised_payload"]["evidence_urls"] == ["https://example.org/a"]
    assert rec["source_url"] == "https://example.org/a"
    assert rec["external_id"].startswith("hw-test-broadcaster-")


def test_shape_record_drops_not_hybrid():
    item = {"title": "Routine story", "link": "https://example.org/b",
            "description": "body", "guid": "g2"}
    rec = shape_record(item, "Test Broadcaster",
                       classify_fn=_fake_classifier("not_hybrid"))
    assert rec is None


def test_shape_record_keeps_needs_review_candidates():
    item = {"title": "Suspicious story", "link": "https://example.org/c",
            "description": "body", "guid": "g3"}
    rec = shape_record(item, "Test Broadcaster",
                       classify_fn=_fake_classifier("needs_review"))
    assert rec is not None
    assert rec["normalised_payload"]["classification_label"] == "needs_review"
