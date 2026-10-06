"""Pytest suite for the hybrid-warfare classifier (rules engine).

Covers the citable definition clauses (blend = 2+ domains + exploitation),
target-type tagging, ISO3 resolution, confidence band, and the "possible"
label ladder. Pure functions only -- no network.
"""

from __future__ import annotations

from hybrid_classification import (
    CLAUSE_LABELS,
    Classification,
    classify,
    resolve_iso3,
    INDICATORS_MILITARY,
    INDICATORS_INFO,
)


def _class(text: str, title: str = "") -> Classification:
    return classify(text, title)


def test_blend_plus_exploitation_is_possible_hybrid():
    text = (
        "Russian special forces alongside a coordinated disinformation campaign "
        "exploited societal polarisation to mount a coup d'etat and target NATO "
        "air bases in Poland ahead of the election, a classic hybrid playbook."
    )
    c = _class(text)
    assert c.label == "possible_hybrid_warfare"
    assert set(c.domains) >= {"military", "info", "governance"}
    assert c.target_type == "military"
    assert c.attacked_iso3 == "POL"
    assert c.confidence_score >= 70
    assert c.summary  # non-empty summary


def test_single_domain_with_exploitation_is_needs_review():
    # A lone cyber incident that also exploits a vulnerability stays for review.
    text = (
        "Suspected hackers exploited a zero-day vulnerability to breach systems "
        "at a hospital power grid in Germany overnight."
    )
    c = _class(text)
    assert c.label == "needs_review"
    assert "cyber" in c.domains
    assert c.target_type == "civilian"
    assert c.attacked_iso3 == "DEU"
    assert c.confidence_score >= 60


def test_dual_target_classified():
    text = (
        "A cyber attack and disinformation exploited a vulnerability targeting "
        "both a military base and a city hospital in Ukraine."
    )
    c = _class(text)
    assert c.label == "possible_hybrid_warfare"
    assert c.target_type == "dual"
    assert c.attacked_iso3 == "UKR"
    assert set(c.domains) >= {"military", "info", "cyber"} and "military" in c.domains


def test_pure_conventional_single_domain_is_not_hybrid():
    # A routine, single-domain military strike with no exploitation language.
    text = "An airstrike hit a training camp in Latvia after border patrol reported activity."
    c = _class(text)
    assert c.label in {"needs_review", "not_hybrid"}
    # No definitional vulnerability exploitation -> never a confident hybrid.
    assert c.label != "possible_hybrid_warfare"


def test_purely_unrelated_text_is_not_hybrid():
    text = "The parliament approved the annual budget for education and transport."
    c = _class(text)
    # substring "port" inside "transport" can false-positive a target tag, but
    # the label ladder still rejects the record entirely -> not harvested.
    assert c.label == "not_hybrid"
    assert c.attacked_iso3 is None
    assert c.confidence_score < 40


def test_clauses_map_to_definition_sources():
    # Each domain bucket maps to a citable NATO/EU/HybCoE clause string.
    for key, label in CLAUSE_LABELS.items():
        assert key in {"military", "info", "cyber", "economic", "governance"}
        assert "NATO" in label or "EU" in label or "HybCoE" in label or "hybrid" in label.lower()


def test_resolve_iso3_known_countries():
    assert resolve_iso3("a flare-up in romania near the moldova border") == "ROU"
    assert resolve_iso3("tensions in the baltic states, estonia said") == "EST"
    assert resolve_iso3("nothing here about nations") is None


def test_classification_is_reproducible():
    text = ("Polish officials accused russian special forces of a disinformation "
            "campaign exploiting divisions ahead of drills near the border.")
    a = _class(text)
    b = _class(text)
    assert a.label == b.label
    assert a.domains == b.domains


def test_title_boost_helps_classification():
    # Title alone carrying the blend should still classify when body is thin.
    c = _class("details below", title="Russian disinformation and cyberattack exploit vulnerabilities")
    assert c.label == "possible_hybrid_warfare"
    assert set(c.domains) >= {"info", "cyber"}


def test_confidence_capped_at_100():
    text = (
        "Full-spectrum hybrid: special forces, disinformation, cyber attack, "
        "economic coercion, and a coup all exploiting every vulnerability in "
        "poland's government and military bases."
    )
    c = _class(text)
    assert c.confidence_score <= 100
    assert c.confidence_score >= 90
    assert c.label == "possible_hybrid_warfare"
