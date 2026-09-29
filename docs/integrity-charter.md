# Defence Intelligence Platform — Integrity Charter

## Purpose

This charter defines the principles that govern how intelligence
data is sourced, ingested, curated, and presented across the Defence
Intelligence Platform.  Its purpose is to ensure that **commercial
influence cannot affect factual outcomes** and that every record
carries a transparent, evidence-grade provenance.

## 1. Editorial Independence

1. **No paid influence over factual outcomes.**  No payment, equity
   stake, or commercial relationship may be accepted from a vendor,
   defence contractor, or government entity in exchange for:
   - The inclusion, exclusion, or prioritisation of intelligence
     records;
   - The adjustment of confidence scores or provenance labels;
   - The suppression of unfavourable findings.

2. **Source transparency.**  Every record displayed to users must
   carry a visible attribution to its original source publisher.  Where
   a source requires credentials (API keys, subscriptions), the
   platform must indicate this in the source catalogue so users
   understand access limitations.

3. **Ingestion review.**  All new data ingested from external sources
   must pass through the ingestion review pipeline.  An analyst must
   approve or reject changes before they enter the core intelligence
   database.  This gate is enforced in code — authenticated,
   non-administrator users cannot bypass it.

## 2. Evidence-Level Taxonomy

Every intelligence record is tagged with an **evidence level** that
communicates its sourcing and verification strength:

| Level           | Definition                                                |
|-----------------|-----------------------------------------------------------|
| `primary_source`| Directly from an official primary source document.       |
| `corroborated`  | Verified by two or more independent sources.              |
| `single_source` | From a single source, not yet cross-referenced.           |
| `inferred`      | Derived from analyst interpretation, not directly observed.|
| `demonstration` | Demo / test fixture data, not from live ingestion.       |
| `unverified`    | Reported but not yet assessed.                            |

### Record Status

| Status        | Definition                                          |
|---------------|-----------------------------------------------------|
| `live`        | Actively maintained from live sources.              |
| `partial`     | Populated from a subset of sources or historical.   |
| `published`   | Curated, reviewed, and published to the feed.       |
| `demo`        | Demo / test fixture data.                           |
| `archived`    | Superseded by newer data.                           |
| `suppressed`  | Withheld pending review or legal concern.           |

**Key rule:** Records tagged `demonstration` must only be served when
`NEXT_PUBLIC_USE_DEMO_DATA=true` is set in the environment.  In
production, demo data must never be presented as live intelligence.

## 3. Data Freshness and Coverage Claims

The platform must accurately represent data freshness and coverage:

- **Coverage claims** must be verifiable against the ingestion pipeline.
  A source listed as "Live" must have a working adapter in the data
  pipeline.  Sources without adapters must be marked
  `adapterStatus: "manual-review"` and must not be presented as
  actively ingested.
- **Freshness claims** must include the date of the last successful
  ingestion run.  Stale data must be clearly labelled.
- **Confidence scores** on intelligence records must reflect source
  reliability, corroboration count, and chain-of-custody metadata —
  not just metadata field completeness.

## 4. Audit Trail

Every intelligence change is recorded in the `data_changes` table
with:

- The identity of the user who made the change;
- The source the change is attributed to;
- A confidence level and importance rating;
- Timestamps for creation and review;
- A review trail (who reviewed, when, and the decision).

No intelligence change may be written to the database without a
source attribution.  Self-sourced changes are prohibited.

## 5. Access Control

- **Admin routes** (`/admin/*`) require platform analyst or
  administrator role, enforced both in the Next.js middleware and in
  individual API routes.
- **Write API routes** require both authentication and role
  verification.  Administrator-scoped routes additionally call the
  `is_platform_admin` RPC.
- **Sensitive endpoints** (search, login, signup, checkout) are
  rate-limited both per-instance and globally via a Supabase-backed
  counter table.
- **CSRF protection** is enforced on all POST/PUT/DELETE/PATCH API
  routes via the double-submit cookie pattern.  Server-to-server
  calls use bearer-token authentication.

## 6. Review and Amendment

This charter is a living document.  Proposed changes to the editorial
process, evidence taxonomy, or access-control model must be reviewed
by at least two platform analysts and documented in the project's
change log before deployment.
