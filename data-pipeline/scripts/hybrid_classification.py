#!/usr/bin/env python3
"""Hybrid-warfare incident classifier.

Encodes the citable, official definition of hybrid warfare as a deterministic
rules engine so that classification is auditable and reproducible (no black-box
LLM in the default path; an optional LLM enrichment stage can layer on top).

Definition sources (per the accepted plan):
  1. NATO glossary (Joint Publication 3.20, "Hybrid warfare") -- a state or
     non-state actor uses a "blend" of conventional and non-conventional means,
     coordinated across domains, to achieve an asymmetric advantage while
     remaining (at least partly) deniable.
  2. EU JOIN(2016) 18 ("EU policy on hybrid threats") -- hybrid threats are a
     "broad range of means" -- diplomatic, information, cyber, economic,
     military, intelligence -- "employed in a coordinated manner" against one or
     more EU Member States, "exploiting vulnerabilities".
  3. EU HybNet / Hybrid CoE operational framework -- the canonical "five tools"
     of hybrid threats: (a) armed force / proxy / irregular fighters,
     (b) information operations & disinformation, (c) cyber operations,
     (d) economic / energy coercion, (e) political / governance interference,
     used in concert by state or proxy.

A text is labelled *possible* hybrid warfare when it exhibits **co-ordinated use
of two or more of these domains/tactics against a target that exploits a
vulnerability** (the defining "blend" + "coordination" + "exploitation" triad).
Single-domain events (pure cyberattack, a pure airstrike, a lone leak) do not
by themselves clear the bar and score lower, but are still surfaced as
`needs_review` because the source may under-report the blended nature.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Iterable

# (a) armed force / proxy / irregular fighters
INDICATORS_MILITARY: list[str] = [
    "special forces", "spetsnaz", "little green men", "unmarked", "proxy fighters",
    "irregular", "private military", "pmcw", "paramilitary", "separatist",
    "militia", "raiding", "sabotage", "attack aircraft", "military convoy",
    "military base", "armed forces", "troop deployment", "invasion force",
    "shelling", "bombing", "missile strike", "airstrike", "drone strike",
    "artillery", "gunship", "raiding craft", "naval blockade", "military exercise",
    "invasion", "incursion",
]

# (b) information operations & disinformation
INDICATORS_INFO: list[str] = [
    "disinformation", "false narrative", "fake news", "infowar", "information "
    "operation", "propaganda", "troll", "bot network", "deepfake", "leaked",
    "document dump", "hack-and-leak", "hackandleak", "media manipulation",
    "false flag", "psyops", "psychological operation", "smear campaign",
    "astroturf", "coordinated inauthent",
]

# (c) cyber operations
INDICATORS_CYBER: list[str] = [
    "cyber attack", "cyberattack", "ddos", "data breach", "hack", "ransomware",
    "spear-phish", "phishing campaign", "malware", "backdoor", "zero-day",
    "satellite jamming", "gps jamming", "radio jamming", "blackout", "cyber",
]

# (d) economic / energy coercion
INDICATORS_ECONOMIC: list[str] = [
    "sanction", "energy cut", "gas cut", "oil cut", "supply cut", "trade ban",
    "economic coercion", "currency attack", "banking disruption", "debt trap",
    "bribe", "corruption", "oligarch", "financial pressure", "market manipulation",
]

# (e) political / governance interference
INDICATORS_GOV: list[str] = [
    "election interference", "vote buying", "electoral", "coup", "coup d'état",
    "assassination", "targeted killing", "intimidation", "co-opt", "capture the "
    "state", "compromise official", "leak of", "bribing official",
]

# Vulnerability exploitation patterns (definitional "exploit").
INDICATORS_VULN: list[str] = [
    "exploit", "vulnerability", "weakness", "fracture", "divide",
    "polarisation", "leverage", "amid", "amidst", "capitalis",
]

# Target-type signals -> civilian infrastructure vs military.
CIVILIAN_TARGETS: list[str] = [
    "power grid", "power station", "substation", "electricity", "grid",
    "water supply", "water treatment", "hospital", "school", "university",
    "transport hub", "railway", "airport", "seaport", "port", "fuel depot",
    "pipeline", "telecom", "internet backbone", "media outlet",
    "civilian", "residential", "town", "city", "village",
]

MILITARY_TARGETS: list[str] = [
    "military base", "air base", "naval base", "weapons depot", "ammunition",
    "defence ministry", "ministry of defence", "military HQ", "command centre",
    "arms factory", "munitions", "missile site", "radar station",
    "military installation", "armed forces", "soldier", "troop",
]

# Compact ISO alpha-3 lookup for countries that appear in European public-
# broadcaster feeds. Used to resolve the attacked nation for the atlas.
COUNTRY_ISO3: dict[str, str] = {
    "poland": "POL", "germany": "DEU", "france": "FRA", "ukraine": "UKR",
    "russia": "RUS", "great britain": "GBR", "britain": "GBR", "england": "GBR",
    "scotland": "GBR", "wales": "GBR",    "ireland": "IRL",
    "lithuania": "LTU", "latvia": "LVA", "estonia": "EST",
    "nato": "USA", "romania": "ROU", "bulgaria": "BGR", "hungary": "HUN",
    "czech": "CZE", "czechia": "CZE", "slovakia": "SVK", "slovenia": "SVN",
    "croatia": "HRV", "serbia": "SRB", "bosnia": "BIH", "montenegro": "MNE",
    "georgia": "GEO", "moldova": "MDA", "türkiye": "TUR", "turkey": "TUR",
    "spain": "ESP", "portugal": "PRT", "italy": "ITA", "greece": "GRC",
    "netherlands": "NLD", "belgium": "BEL", "luxembourg": "LUX", "austria": "AUT",
    "switzerland": "CHE", "sweden": "SWE", "finland": "FIN", "norway": "NOR",
    "denmark": "DNK",
}

# Clauses map 1:1 onto the definition sources above; used for `definition_clause`.
CLAUSE_LABELS = {
    "military": "(1) Coordinated use of armed force / proxy / irregular fighters "
                "[NATO JP 3.20; HybCoE tool 1]",
    "info": "(2) Information operations & disinformation "
            "[EU JOIN(2016) 18; HybCoE tool 2]",
    "cyber": "(3) Cyber operations exploiting vulnerabilities "
             "[EU JOIN(2016) 18; HybCoE tool 3]",
    "economic": "(4) Economic / energy coercion "
                "[EU JOIN(2016) 18; HybCoE tool 4]",
    "governance": "(5) Political / governance interference "
                  "[HybCoE tool 5; EU hybrid threat framework]",
}


@dataclass
class Classification:
    """Result of classifying a single news item."""

    label: str  # 'possible_hybrid_warfare' | 'not_hybrid' | 'needs_review'
    confidence_score: int  # 0-100
    target_type: str | None  # 'military' | 'civilian' | 'dual' | None
    attacked_iso3: str | None
    clauses_matched: list[str] = field(default_factory=list)
    definition_clause: str = ""
    summary: str = ""

    # Domain buckets that fired, for the longitudinal record.
    domains: list[str] = field(default_factory=list)


def _hit(text: str, needles: Iterable[str]) -> list[str]:
    low = text.lower()
    return [n for n in needles if n in low]


def resolve_iso3(text: str) -> str | None:
    """Best-effort ISO alpha-3 of the attacked nation from a keyword scan."""
    low = text.lower()
    for name, iso in COUNTRY_ISO3.items():
        if name in low:
            return iso
    return None


def classify(text: str, title: str = "") -> Classification:
    """Classify a news item against the hybrid-warfare definition.

    The blend requirement (two+ domains coordinated against an exploitable
    target) is enforced explicitly: a single-domain hit is recorded as
    `needs_review`, not as a confident hybrid finding.
    """
    haystack = f"{title} {text}".lower()

    domains_hit: dict[str, list[str]] = {
        "military": _hit(haystack, INDICATORS_MILITARY),
        "info": _hit(haystack, INDICATORS_INFO),
        "cyber": _hit(haystack, INDICATORS_CYBER),
        "economic": _hit(haystack, INDICATORS_ECONOMIC),
        "governance": _hit(haystack, INDICATORS_GOV),
    }
    active = [d for d, hits in domains_hit.items() if hits]
    vuln = len(_hit(haystack, INDICATORS_VULN)) > 0

    # Target type: military vs civilian infrastructure (the plan's catalogue).
    c_hits = _hit(haystack, CIVILIAN_TARGETS)
    m_hits = _hit(haystack, MILITARY_TARGETS)
    if c_hits and m_hits:
        target_type = "dual"
    elif m_hits:
        target_type = "military"
    elif c_hits:
        target_type = "civilian"
    else:
        target_type = None

    attacked_iso3 = resolve_iso3(haystack)

    # Confidence from number of domains (blend) + vulnerability exploitation.
    domain_score = min(len(active), 5) * 14      # up to 70 for a 5-domain blend
    vuln_bonus = 20 if vuln else 0               # exploitation is definitional
    target_bonus = 10 if target_type else 5
    confidence = min(100, 25 + domain_score + vuln_bonus + target_bonus)

    # Label ladder:
    #  * >= 2 domains + a vulnerability = confident "possible" hybrid finding
    #  * single domain + vulnerability = needs_review (may be under-reported)
    #  * single domain, no vulnerability = not hybrid (pure conventional/incident)
    if len(active) >= 2 and vuln:
        label = "possible_hybrid_warfare"
    elif len(active) >= 1 and vuln:
        label = "needs_review"
    else:
        label = "not_hybrid" if not active else "needs_review"

    clauses_matched = [CLAUSE_LABELS[d] for d in active]
    # Single human-readable clause summarising which definition tools fired.
    definition_clause = "; ".join(f"{d}: {', '.join(domains_hit[d][:2])}" for d in active)

    # Crude but evidence-based one-line summary (summarisation if
    # corroborated is an LLM stage the planner left optional / gated).
    summary = _summarise(text, title, active)

    return Classification(
        label=label,
        confidence_score=confidence,
        target_type=target_type,
        attacked_iso3=attacked_iso3,
        clauses_matched=clauses_matched,
        definition_clause=definition_clause or "no definitional clause matched",
        summary=summary,
        domains=active,
    )


def _summarise(text: str, title: str, domains: list[str]) -> str:
    """Pull the first sentence that mentions a domain indicator."""
    import re

    first_line = title.strip() or ""
    # Join body sentences; prefer the one mentioning the strongest signal.
    body = re.split(r"(?<=[.])\s+", text.strip())
    for sent in body[:8]:
        if any(d in sent.lower() for d in domains):
            first_line = sent if not first_line else first_line
            break
    if not first_line and title:
        first_line = title
    return first_line[:320]
