# Data Pipeline

Python ingestion scripts for importing and normalizing OSINT data.

## Ingestion status

`supabase/migrations/20260925_ingestion_provenance.sql` and
`20260926_full_schema.sql` are **not applied** to the live database. The live
`ingestion_queue` table predates migration 20260925 and is missing the
provenance columns that migration adds:

| Column | Live DB | Added by 20260925 |
| --- | --- | --- |
| `source_url`, `published_at`, `retrieved_at` | absent | yes |
| `verification_status`, `confidence_score` | absent | yes |
| `raw_payload`, `normalised_payload` | present | yes |

`ingestion_queue` is additionally **write-protected by row-level security**: a
POST with the project anon key returns
`42501 new row violates row-level security policy`. Only an authenticated
platform admin can insert, via `POST /api/intelligence/ingestion`.

Consequently the importers in this directory **do not write to the database
directly**. They normalise records and emit a payload file that an admin
session replays through the ingestion API. This also keeps the platform
compliant with the Integrity Charter (section 1.3): records enter the review
queue and are promoted by an analyst rather than written straight into a core
intelligence table.

### Applying the pending migrations

The Supabase CLI is not installed in this repo. To reconcile the database with
the migrations on disk, back up first and then push:

```bash
supabase db dump --file backup.sql
supabase db push
```

Do this before relying on the provenance columns below; the review queue and
the data-quality views depend on them.

## HIIK armed conflicts

```bash
../.venv/bin/python scripts/ingest_hiik_conflicts.py --dry-run
../.venv/bin/python scripts/ingest_hiik_conflicts.py
```

Reads `data/hiik_2025_conflicts.csv` (89 rows, 87 unique conflicts) and writes
`data/hiik_2025_ingestion_payload.json`.

Mapping notes:

- HIIK `region_section` values map to the platform `conflicts.region` vocabulary.
- 35 of 89 rows carry the literal `UNKNOWN` region emitted by
  `parse_hiik_pdf.py`; these are recorded with `region: null` and a lower
  confidence score rather than being forced into a bucket.
- HIIK `status_change` maps to the `conflicts.status` check constraint
  (`escalated -> Active`, `stable -> Frozen`, `de-escalated -> Resolved`).
  Rows marked `review` are treated as `Frozen`.
- `external_id` is a deterministic `hiik-2025:<slug>:p<page>` key so re-running
  the importer does not create duplicates.

## US federal awards (USAspending)

```bash
../.venv/bin/python scripts/fetch_usaspending_contracts.py --max-pages 3
```

No API key required. Output: `data/usa_spending_contracts.json`.

Verified behaviour of the `spending_by_award` endpoint:

* The honoured sort parameters are **`sort` and `order` together**. A bare
  `order` key is silently ignored, which previously left results unordered and
  surfaced the smallest awards instead of the significant ones.
* **`Awarding Sub Agency` is the useful filter.** The parent `Awarding Agency`
  is "Department of Defense" for essentially every defence award, so filtering
  on the parent cannot separate defence work from anything else. The sub agency
  distinguishes Navy, Army, Air Force, DCMA, DLA, MDA and SOCOM.
* The endpoint does **not** publish period-of-performance dates or award type
  for contract-level results. Those fields are written as `null` together with a
  `source_limitation` note, because they are absent from the source rather than
  missing from our extraction. Use `/api/v2/awards/` or FPDS for them.
* `Award ID` is a short PIID/agency prefix shared by thousands of unrelated
  awards (for example `0002` appears on 70 different contracts in a single
  run). Deduplication uses `generated_internal_id`, which is 1:1 with an award.
* One combined search per company is issued with all of its aliases, rather
  than one search per alias. Aliases overlap ("Airbus" also matches Airbus
  commercial, "Leonardo" also matches Leonardo DRS), so per-alias searches both
  double count and let one alias capture another company's subsidiaries.
  `recipient_name` is retained on every record so a reviewer can reattribute a
  subsidiary or joint venture.

The company catalogue is keyed by slug (`lockheed-martin`), not by a database
id, because the live `companies` table uses its own identity sequence. Resolve
`company_slug` to `companies.id` during promotion.

## ACLED conflict events

```bash
../.venv/bin/python scripts/fetch_acled_events.py --dry-run
../.venv/bin/python scripts/fetch_acled_events.py --year 2025
```

Requires `ACLED_API_KEY` (and `ACLED_EMAIL`) in `data-pipeline/.env`. ACLED
issues keys per person or institution after they accept the Terms of Use; it is
free for research, media, academic and think-tank use. Register at
<https://acleddata.com/register/>.

Events normalise onto the declared `conflict_events` columns (`week`, `region`,
`country`, `event_type`, `sub_event_type`, `events`, `fatalities`,
`population_exposure`, centroid latitude/longitude). Actor, location, ISO3 and
source fields are retained in the payload for analyst review because the table
has no column for them. The licence and terms URL are written into the output
document alongside the data.

⚠️ `conflict_events` does not exist on the live database. Apply the pending
migrations before promoting events.

## SIPRI Arms Transfers Database (volume of transfers of major arms)

```bash
../.venv/bin/python scripts/parse_sipri_transfers.py --dry-run
../.venv/bin/python scripts/parse_sipri_transfers.py
```

Reads `SIRPI weapon exports 2000-2025.csv` and `SIRPI weapon imports
2000-2025.csv` from `/Users/leorosenthal/Desktop/Datasets/nations`, melts the
wide format to one row per country/year/direction, and writes
`data/sipri_arms_transfers.json` for promotion into `public.arms_transfers`
(created by `supabase/migrations/20260930_arms_transfers.sql`).

⚠️ **The two CSVs currently contain only the SIPRI metadata preamble and the
header row — zero data rows (725 bytes each).** The parser detects this and
exits with instructions rather than producing an empty import. Re-export from
<https://www.sipri.org/databases/armstransfers> (free registration), select
2000–2025 for both the supplier and recipient views, and confirm the files
contain country rows before running the importer.

Units and conventions:

* Values are **millions of SIPRI trend-indicator values (TIV)**. TIV is a
  capability volume index, **not currency**, and is not comparable to
  `budgets.amount_usd`. The column is `tiv_millions` for that reason.
* SIPRI cell conventions are preserved in `tiv_status` rather than coerced to
  zero, which would understate transfers:
  * `'0'` → `lt_half` (between 0 and 0.5 million TIV, not zero)
  * `'..'` → `unavailable`
  * blank → `none` (no deliveries identified)
* SIPRI's own country groupings ("Other NATO countries", "Various countries")
  are kept verbatim in `country_name`; they carry meaning a `country_id` join
  would destroy, so `country_id` is left null for them.
* Trailing aggregate columns (`2000-2025`, `Percentage`, `Sum total years`,
  `Percentage of total`) are skipped; only real year columns are melted.

## Navbase fleet list (world order of battle)

```bash
../.venv/bin/python scripts/recover_navbase_fleetlist.py --dry-run
../.venv/bin/python scripts/recover_navbase_fleetlist.py
```

Recovers vessel records from `Navy dataset.xlsx`. Output:
`data/navbase_fleetlist.json` — 1,362 records, 42 sections, 1948–2025.

**That xlsx is not a spreadsheet export.** It is a scraped Navbase page in
which every cell was collapsed into column A, so the visible rows are page
furniture (`Navbase`, `Home » Navbase » Fleet Lists`, `Aircraft Carriers:`)
rather than data. The real table survives only as a flat run of 14,252 shared
strings, so the parser reconstructs rows from the token stream. It reads the
xlsx as a zip of XML using only the standard library, because `openpyxl` is
not installed in this project.

Row shapes that occur, and how the parser tells them apart:

* **Six fields** — `Type, Class, Ship, Code, Year, Tonnage`
  (`CVN / Nimitz / George H.W. Bush / CVN-77 / 2009 / 104600`)
* **Five fields** — Navbase omits `Ship` when the vessel name equals the class,
  so the row shifts left and the **tonnage precedes the year**
  (`FSG / Tarantul (12411) / R-60 / 207 / 1987`)
* **Two-part identifier** — European navies add a builder or pendant reference
  after the hull code (`SSK / Type 212A / U-31 / S181 / 2005 / 1830`), kept in
  `builder_ref` so no source value is discarded

The walk anchors on the hull code and reads the adjacent numbers **by value**
rather than by position, because 597 genuine hull numbers (`R91` Charles de
Gaulle, `D32` Daring) are indistinguishable from builder references by pattern
alone; heuristics on token shape misclassified hundreds of real vessels.

Data quality, recorded rather than smoothed over:

* 35 of 1,362 records are published by Navbase **without a tonnage**. These are
  counted and reported separately so they are not read as zero displacement.
* 61 hull codes are **reused across navies** (Spain's `F101` Álvaro de Bazán and
  Qatar's `F101` Al Zubarah are different ships), so the destination table must
  key on `(code, vessel_type, section)` and never on `code` alone.

⚠️ **Units.** `tonnage` is displacement in tonnes as published by Navbase. It is
**not** SIPRI trend-indicator value and must never be summed with
`arms_transfers.tiv_millions` or `budgets.amount_usd`.

⚠️ **Reliability.** Navbase is a community-maintained compilation, not an
official navy publication. The payload records that explicitly
(`reliability: "Community-maintained"`) rather than implying official status.

## WDMMA aircraft inventories

```bash
../.venv/bin/python scripts/scrape_wdmma.py --dry-run
../.venv/bin/python scripts/scrape_wdmma.py
../.venv/bin/python scripts/scrape_wdmma.py --slug russian-air-force --slug usaf
```

Scrapes the [World Directory of Modern Military
Aircraft](https://www.wdmma.org/) index and all 130 air service pages. Output:
`data/wdmma_aircraft_inventory.json` — 2,634 aircraft holdings, 48,869 active
airframes and 9,356 on order across 101 countries, targeting
`country_equipment`.

HTML is cached under `data/wdmma_cache/` (gitignored) so re-running after a
parser change does not re-request 130 pages. `--delay` defaults to 1.0s,
`--no-cache` forces a refresh, and `--max-pages` caps a run.

**The inventory is not a table.** Each aircraft is a "plate" carrying its count,
designation, role, operator flag and image in nested divs, with the descriptive
text inside a JavaScript `on(...)` handler.

### Two page templates

| Template | Pages | Markup |
| --- | --- | --- |
| Modern | 89 | `div.acPlateContainer.zoom.picTrans` with `onClick` |
| Legacy | 41 | `div.acPanelFormatting` with `onclick` |

The legacy template is still served for most naval aviation and smaller air
forces. `detect_template` picks between them, and the reconciliations below are
what prove a template is being read correctly. Three quirks cost real data
before they were handled, and each has a regression test:

* **Section headings are not one colour.** The modern template renders every
  section dark-on-light, but the legacy "On Order" strip is white-on-dark.
  Matching only the dark variant left the legacy On Order heading unrecognised,
  so its aircraft were attributed to the preceding *active* section — inflating
  32 services and making their holdings sum to *more* than the page's own
  published total.
* **`onclick` casing and trailing attributes vary.** Royal Bahraini writes
  `onClick`, Italian Army Aviation writes `onclick`, and Spanish Army Aviation
  closes the tag with `'")" style="...":...>`. Anchoring on an exact tag end
  silently returns zero rows while the page's published total still looks
  correct.
* **Readiness numbers reuse the plate classes.** Before the first section
  heading each page carries a `rankBoxes` block (TruVal Rating `55.3`, Global
  Rank `11/129`). Scraping `textJumbo` page-wide turns those into a fractional
  aircraft count, so plates are attributed to a section by document offset and
  anything before the first heading is discarded.

### Self-validation

Every page publishes its own totals, so a parse that drops aircraft is
detectable rather than quietly wrong. Each section is reconciled against its
stated total (a `TOTAL` plate on the modern template, a bracketed count in the
heading on the legacy one), and each service against its headline. **123 of 130
services reconcile exactly.** `external_id` is a deterministic
`wdmma:<slug>:<active|on-order>:<category>:<designation>` key, so re-running
does not create duplicates.

### Data quality, recorded rather than smoothed over

* **7 services do not fully reconcile** (`active_sum` warnings), each off by
  3–11 airframes out of 50–275. Left as warnings rather than adjusted, since
  silently "fixing" them would invent numbers WDMMA never published.
* **6 section totals disagree with their own plates.** Some are rounding in
  WDMMA's own markup; Belgian Air Component's Fighters total (90) is more than
  double the sum of its plates (46), which looks like a source error.
* **11 services disagree with the index page.** WDMMA's own index is stale for
  these (Netherlands 222 vs 146, Venezuela 183 vs 140). The page figure is
  preferred; the index count is retained on the summary for comparison.
* **47 services publish no Global Rank.** These are WDMMA omissions — the
  rank panel is simply absent from those pages — not parse failures.

⚠️ **Copyright.** WDMMA states its written content and imagery are copyrighted
and not for reuse/republication. This scraper stores only factual fields —
counts, designations, roles, section shares, flags and image **paths** — and
deliberately discards the per-aircraft descriptive blurbs. Images are referenced
by path, never downloaded or redistributed. Do not republish WDMMA prose or
imagery.

⚠️ **Reliability.** WDMMA is a community-maintained enthusiast directory, not an
official inventory. The payload records that explicitly
(`reliability: "Community-maintained"`).

⚠️ **Units.** Counts are airframes and **exclude UAVs**, which WDMMA does not
track. This is stated per record in `unit_note` and must not be mixed with
`budgets.amount_usd` or `arms_transfers.tiv_millions`.

## Known data gaps

- **SIPRI arms transfers: pipeline built, source data still empty.** The
  `SIRPI weapon *.csv` files are 725-byte headers with zero data rows. See the
  SIPRI Arms Transfers section above for the re-export steps. The
  `arms_transfers` table now exists in
  `supabase/migrations/20260930_arms_transfers.sql` but that migration is
  **not yet applied** to the live database.
- **USAspending is now ingested.** `data/usa_spending_contracts.json` holds real
  awards fetched from the live API and filtered on awarding sub-agency. The
  previous 1,168-record file was fetched without sorting or sub-agency
  filtering and undercounted by orders of magnitude; it is superseded and kept
  only as a comparison.
- **GLEIF cannot supply defence companies.** A scan of 40,000 records in
  `lei2_latest.json.zip` found **zero** SIC or NAICS codes. LEI records carry
  only `LegalName`, address, jurisdiction, category and status, so there is no
  industry classification to filter on. `ingest_gleif.py` already falls back to
  keyword matching on the company name. Do not spend time on the 1.1GB golden
  copy for the companies table.
- **Arms transfers have no destination table.** The schema declares no
  arms-transfers table, and `public.exports` is a per-user generated-CSV log.
  Adding one is a schema decision, not a parser task.

## Source access

The application source registry is available at `/sources`. It separates public
feeds from sources that require credentials, a commercial licence, or manual
research ingestion.

The existing GLEIF relationship importer is the only live Neo4j importer in
this repository. Public and authenticated source adapters should normalize
records into the same evidence model before they are promoted into application
tables. Do not scrape investigative publishers or use commercial feeds without
checking their terms and redistribution rights.

USAspending is integrated into company profiles and can be bulk fetched for
the current company catalog with:

```bash
../.venv/bin/python scripts/fetch_usaspending_contracts.py
```

The output is normalized with `source_registry_id: usaspending`, award IDs,
recipient names, agencies, amounts, periods, and source URLs. The API covers US
federal awards from 2007-10-01 onward; it does not represent all global defence
contracts. Awards are filtered using defence agency and programme terms before
being written. Other national procurement sources require separate adapters.

Public sanctions acquisition is available with:

```bash
../.venv/bin/python scripts/fetch_public_sources.py
```

This downloads OFAC and UN sanctions records and discovers official UK
sanctions downloads. It preserves raw records and provenance in
`data/public_sources/public_source_records.json`. UCDP, ACLED, Companies House,
OpenCorporates, OpenSanctions, MarineTraffic, Janes, IISS, satellite imagery,
and similar sources remain gated by their API credentials, accounts, or
licences and are not bypassed by this runner.

For item-level detail, the normalized award record deliberately leaves fields
blank when the source does not publish them. Add FPDS/award-detail records and
contract line-item or procurement-notice datasets for quantities and unit
prices; use DSCA Foreign Military Sales notifications, export-licence records,
and recipient-country procurement data for destination; use DoD programme and
budget justification records for capability importance.

Copy `.env.example` to `.env` and add credentials only for sources that have
been approved for the deployment. The example file intentionally contains no
secrets.
# Defence-platform
