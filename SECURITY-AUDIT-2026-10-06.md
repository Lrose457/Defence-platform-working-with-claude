# Security Sweep — Remaining Weaknesses (2026-10-06)

Follow-up to the October 2026 audit and patches 0.3/0.4. This sweep re-verified
the whole posture from the outside (publishable anon key only) and hunted for
what the first audit did not cover. Status vocabulary: FIXED (patched in this
sweep), OPEN (action needed), ACCEPTED (understood residual, documented).

## Method

- Supabase security advisor re-run (security lints).
- Live anon-key PostgREST matrix: POST/PATCH/DELETE × 5 core tables, reads × 4
  private tables, `profiles` row visibility, rate-limit RPC validation.
- Full endpoint matrix on the production build (:3100): every `/api/*` route,
  admin redirects, bearer gates, error bodies.
- Header audit on `/`, git **full-history** secret scan, `npm audit`
  (prod + full), review of new untracked user migrations and the telemetry/
  ops code paths.

## Findings

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| F1 | HIGH? no — **MED** | Leaked-password protection disabled (advisor WARN). Auth signup accepts compromised passwords. Dashboard-only fix (mgmt token lacks `auth_config_write`). | OPEN — user dashboard action |
| F2 | MED | Stripe webhook inert: service-role key unminted (`lib/supabase/admin.ts` throws); `STRIPE_WEBHOOK_SECRET` exists in `.env.local` but the launchd process booted before it was added — module-level `const` captured `undefined` at start. Price IDs (`STRIPE_ANALYST_PRICE_ID`, `STRIPE_ORGANISATION_PRICE_ID`) also unminted. | OPEN — mint keys, restart app |
| F3 | LOW | Webhook error bodies disclosed configuration state to unauthenticated callers (`"Webhook secret not configured"`, `"Missing Stripe signature"`, …). Genericized; detail kept in server logs. Probe now asserts non-disclosure. | FIXED (this sweep) |
| F4 | LOW | Read-only endpoints with no DB-backed limit: `/api/countries`, `/api/map/geojson`, `/api/sources/catalog`, `/api/satellites/status`; `/api/stocks` + `/api/stocks/history` are in-memory-only. Not in proxy's sensitive list. Flood = per-instance DB/upstream load, not data exposure. Recommendation: extend `dbRateLimit` (fail-open, like satellites) to these. | ACCEPTED (recommended follow-up) |
| F5 | LOW | Rate-limit RPCs remain anon-callable **by design** (the app's own limiter uses them via the publishable key). A direct caller can mint counter rows with any valid key (≤200 chars, charset-checked) — bounded growth, 24 h trim, cannot guess real keys (sha256, 128-bit). Optional hardening: reduce `p_key` max 200 → 64 (app keys are ≤ ~45). | ACCEPTED |
| F6 | LOW | Rate-limit key = hashed UA + accept-language when `TRUST_PROXY` is unset — rotatable by header mutation. Behind Vercel, set `TRUST_PROXY=true` so `x-forwarded-for` becomes the key and rotation dies. Verify at deploy time. | OPEN — deploy config |
| F7 | INFO | `ops_freshness_budgets` publicly readable (budget hours + labels only). Operational metadata; writes denied. | ACCEPTED |
| F8 | LOW | `/api/stocks/history?symbol=…` accepts arbitrary symbols → an unauthenticated sweep can exhaust the Finnhub free-tier quota (bounded by `MAX_CACHE_ENTRIES` 200 + upstream 429 → graceful empty). | ACCEPTED |
| F9 | INFO | Ops telemetry self-fetch `http://127.0.0.1:${PORT ?? 3000}` + JSONL payload history + agent log read from `/tmp` — process-local, contents are {timestamp, kb, ms}. On serverless the self-fetch fails silently → payload check shows "unknown". | ACCEPTED (cosmetic on non-launchd hosts) |
| F10 | LOW | Dev-dep advisories rose 5 → 6 high: new `source-map-js` GHSA-68fv-2mgg-jv7q (event-loop DoS in build tooling). | FIXED (lockfile → 1.2.2, non-breaking) |
| F11 | INFO | No `robots.txt`/`sitemap`; `/admin` not disallowed for crawlers (not a control, hygiene). | OPEN (optional) |
| F12 | INFO | Management access token now returns **401** — the SQL-scoped token documented in SECURITY.md is dead (rotated or revoked). Confirm no copies remain in dashboards/notes; update the runbook item. | OPEN — user confirms |
| F13 | INFO | gitleaks full-history scan added to nightly CI with `--since=2026-10-07` — excludes the two known-dead incident keys by design (history intentionally unrewritten). | FIXED (this sweep) |

## Posture re-verified (all PASS, now guarded nightly)

- **Anon writes denied** on `countries`, `budgets`, `contracts`, `companies`,
  `profiles` — POST 401; PATCH (real payload, nonexistent row) 401
  `permission denied`; DELETE 401/400. Verified value-level: an attempted
  anon UPDATE on `countries` row 1 leaves `United Kingdom` unchanged.
  (Note: an *empty-object* PATCH returns 204 without touching privileges or
  rows — PostgREST quirk, probed with real payloads to avoid false green.)
- **Private tables unreadable** by anon: `anonymous_search_logs`,
  `user_survey_responses`, `privacy_requests`, `rate_limit_counters` → 401.
- **`profiles` exposes zero rows** to anon (SELECT granted, RLS owner-only).
- **RPC validation**: `increment_rate_limit` rejects malformed key/window with
  400 `invalid rate limit parameters`; valid keys accepted.
- **App gates**: survey / opt-out / intelligence / import POST without
  CSRF/bearer → 403; `/admin/*` → 307 to login; `/api/exports/changes` → 401;
  checkout unauthenticated → 307; TLE `refresh=1` cannot be forced without the
  bearer token (served from cache like any read).
- **Rate limiting E2E**: survey limiter trips on the 6th request
  (400×5 → 429), counter in Postgres — survives restarts and instances.
- **Headers**: CSP with per-request nonce, `X-Frame-Options: DENY`, nosniff,
  Referrer-Policy, HSTS (https).
- **History**: no live key-shaped secrets anywhere in history (CI's own
  regexes are the only matches).
- **Dependencies**: `npm audit --omit=dev` clean; full audit = 5 high, all in
  the dev-only `braces`/`micromatch` chain via eslint-config-next (accepted
  residual, patch 0.4).

## User's concurrent work (checked read-only)

New pipeline migrations `20261008_pipeline_extension_tables.sql` and
`20261009_desktop_datasets.sql` enable RLS + public-read policies + SELECT
grants on all 11 new tables before anything else — correct pattern, matches
the 0.3 overhaul. They are **not yet applied** (tables 404 via PostgREST);
once applied the nightly advisor gate will verify them too. See the separate
data-pipeline audit for the scripts that feed them.

## Nightly enforcement

`security-nightly.yml` (this sweep) now runs daily at 02:23 UTC:
1. **probes** — production build + deployed site (when `PROD_URL` repo
   variable is set) through `scripts/security-probe.sh`; fails on any
   regression above.
2. **advisor** — Supabase security advisor compared against an explicit
   allowlist of accepted findings; any new finding fails the build. Needs the
   `SUPABASE_ACCESS_TOKEN` repo secret (SQL-scoped is enough) — the job skips
   with a warning until it is added.
3. **gitleaks** — full-history secret scan.
