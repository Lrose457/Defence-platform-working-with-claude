#!/bin/bash
# Nightly runner for the 10-job Python pipeline extension.
# Usage: scripts/run-pipeline-extensions.sh [--dry-run]
# Offline-safe jobs run always; keyed jobs (SAM.gov, Finnhub) emit
# config stubs when their env vars are unset.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIPE="$ROOT/data-pipeline"
PY="$ROOT/.venv/bin/python"
DRY="${1:-}"
run() { echo "=== $1 == "; $PY "scripts/$1" $DRY || echo "!! $1 failed"; echo; }
cd "$PIPE" || exit 1
run audit_sources.py
run resolve_entities.py
run forecast_budgets.py
run embed_corpus.py
run build_ownership_graph.py
run analyze_overflights.py
run harvest_defence_news.py
run harvest_hybrid_warfare.py
run fetch_comtrade_arms.py
run fetch_sam_opportunities.py
run correlate_stocks_events.py
run import_eda_budgets.py
run import_kiel_aid.py
run import_ucdp_nonstate.py
run import_navbase_fleet.py
