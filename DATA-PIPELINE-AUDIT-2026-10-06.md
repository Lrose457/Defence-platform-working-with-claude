# Data-Pipeline Audit (report-only) — 2026-10-06

**Report-only**: the pipeline is under active development and nothing here was
modified. Scope: `data-pipeline/scripts/**` (~7,800 lines, 30+ files),
`data-pipeline/requirements.txt`, `data-pipeline/README.md`,
`scripts/run-pipeline-extensions.sh`, and the two new Supabase migrations.

## Dimension 1 — Injection / code execution: PASS

- **Zero** dangerous primitives across the whole pipeline: no `subprocess`,
  no `shell=True`, no `os.system`, no `eval`/`exec`, no `pickle`, no
  `__import__` (grep-verified over all `.py`).
- All HTTP calls use `requests` with `params=` (URL-encoded) — no string-built
  URLs from data (Finnhub, GDELT, ReliefWeb, World Bank, UN Comtrade, SAM.gov,
  UCDP, OurAirports).
- No SQL is constructed anywhere: the pipeline never touches Postgres
  directly. Every producer emits **replay JSON** consumed by the
  authenticated `POST /api/intelligence/ingestion` endpoint and reviewed in
  `/admin/ingestion` (`dip_common.py` contract, mirrored by the new
  `make_record`/`write_replay` helpers). Injection surface against the DB is
  therefore one authenticated, CSRF/bearer-gated route — good architecture.

## Dimension 2 — Secrets: PASS with two legacy nits

- New scripts take credentials from the environment only
  (`FINNHUB_API_KEY`, `SAM_GOV_API_KEY`, ACLED key via `fetch_acled_events.py`)
  and write a **config stub** replay when unset instead of crashing or
  bypassing — exactly right.
- No literal tokens in any script (grep for key-shaped literals: clean).
- Nits (pre-existing, tracked scripts):
  - `ingest_gleif.py:748` — `os.environ.get("NEO4J_PASSWORD", "neo4j")`
    default-password fallback; remove the default and fail loudly instead.
  - `ingest_gleif.py:60` — hardcoded personal path
    `/Users/leorosenthal/Downloads/Company data .docx` as default; same for
    `import_navbase_fleet.py` (`/Users/leorosenthal/Desktop/Datasets/…`).
    Prefer a required `--input` flag.
- Minor: Finnhub/SAM keys travel as URL query params (their APIs' design) —
  visible to any intermediate logging the full URL. Acceptable at these
  tiers; prefer header auth if the providers ever offer it.

## Dimension 3 — Licence / provenance compliance: STRONG, three items

Good practice observed: every producer embeds a `licence` string + source URL
into the payload ("the obligation travels with the data"), `fetch_public_sources.py`
explicitly only downloads public files, and the test suite asserts
provenance carriage.

1. **`import_navbase_fleet.py` — placeholder provenance.** `SOURCE_URL =
   "https://navbase.example/fleet-lists"` (a reserved example domain) and the
   data comes from a personal desktop file (`Navy dataset.xlsx`). The replay
   payload therefore asserts a source that does not exist. Fix before any
   promotion: record the true upstream (Navbase product page + terms) or
   reclassify as manually-researched data.
2. **`recover_navbase_fleetlist.py` — facts-only extraction.** It deliberately
   strips copyright markers and keeps numbers only (tests enforce this).
   Facts are not copyrightable, but keep a short written rationale (what is a
   fact vs. expression here) alongside the script so the position is defensible.
3. **Verify-at-download claims.** UCDP GED is documented as CC BY 4.0 (check
   the current UCDP citation requirement at fetch time — the script already
   embeds the URL, good); EDA budget aggregates and the Kiel Ukraine Support
   Tracker data should get a terms check before first public promotion; World
   Bank (CC BY 4.0) and OurAirports (public domain) are unproblematic.

## Dimension 4 — Data integrity & operations: three items

1. **`embed_corpus.py` byte-truncation bug**: `json.dumps(...)[:8_000_000]`
   (and `[:12_000_000]` for vectors) slices the serialized JSON — any corpus
   over the cap produces **invalid JSON** cut mid-token. Check `len()` first
   and fail/split instead of truncating.
2. **`run-pipeline-extensions.sh` always exits 0**: every job's failure is
   swallowed by `|| echo "!! … failed"`, so cron/CI can never detect a broken
   night. Propagate a non-zero exit if any job failed (and quote `$DRY`).
3. **`requirements.txt` is unpinned** (`neo4j`, `requests`, `ijson`, `pandas`,
   `python-dotenv`). Pin (or lock) so nightly runs are reproducible; the
   optional extras (rapidfuzz, skyfield, sentence-transformers) are documented
   as graceful fallbacks — good.

Also noted: the pending migrations (`20261008_pipeline_extension_tables.sql`,
`20261009_desktop_datasets.sql`, and `conflict_events` per the README) are not
yet applied to the live database — the new tables 404 via PostgREST today.
The migration files themselves follow the 0.3 hardening pattern (RLS enabled +
public-read policy + SELECT grants, no write grants), which the nightly
advisor gate will confirm once applied.

## Tests

`scripts/tests/` (~870 lines incl. `test_public_data_sources.py`) is genuinely
strong for a research pipeline: aggregates rejected from country feeds,
provenance/units carried, schema constraints asserted, unknown values stay
null with `source_limitation` notes, violence-type codes not guessed, real
bases vs. hospitals/museums/civil airports disambiguated.

## Bottom line

No injection or secrets exposure. The two things to fix before data from the
new importers is promoted publicly: the Navbase placeholder provenance and
the `embed_corpus` truncation. Everything else is hardening hygiene.
