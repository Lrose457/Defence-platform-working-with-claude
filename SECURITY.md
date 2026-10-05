# Security Incident Report — Service Role Key Exposure

## Summary

A Supabase **service_role key** (`sb_secret_…redacted…` — rotated and verified
dead, literal pruned from this file as of patch 0.3) was committed to the
repository in a stray file named `NEXT_PUBLIC_SUPABASE_ANON_KEY=` at the
project root. The filename falsely implied it was a publishable anon key;
it was in fact a privileged service_role key with full database access.

The file has been **deleted** and added to `.gitignore`. The legitimate anon
key in `.env.local` (now the publishable key `sb_publishable_pkuIs-…nn2u2Im`)
was not affected.

> Note: git history still contains the old key literals. Both are confirmed
> **dead** (the service key returns 401 on every surface; the old publishable
> key was revoked during the earlier outage). History was intentionally left
> unrewritten — see the runbook below.

## Immediate Actions Taken

1. ✅ Deleted the stray file `NEXT_PUBLIC_SUPABASE_ANON_KEY=` (contained `sb_secret_…`).
2. ✅ Deleted the stray file `NEXT_PUBLIC_SUPABASE_URL=` (contained a dashboard URL).
3. ✅ Added both file-name patterns to `.gitignore` to prevent re-creation.
4. ✅ Verified `.env.local` uses the correct publishable anon key, not the service_role key.
5. ✅ (patch 0.2) Rotated the service_role key — old key verified dead (401).
6. ✅ (patch 0.3) Rotated the publishable anon key after the outage root-cause;
    new key registered and verified via the dashboard.

## Actions Required (Manual)

1. ~~Rotate the leaked service_role key~~ — **DONE (patch 0.2)**.
2. ~~Rotate the publishable anon key~~ — **DONE (patch 0.3)**.
3. **Rotate the Supabase management access token** (`sbp_…`) — **STILL OPEN**.
   supabase.com → Account → Access Tokens → generate new, revoke old. The
   token currently in use is SQL-scoped only, but rotation is still required.
4. Audit Supabase access logs for the window during which the key was exposed.

## Key-Rotation Runbook (patch 0.2, updated 0.3)

> Status: service-role key **CLOSED** (rotated, verified 401). Publishable
> key **CLOSED** (rotated during outage recovery). Management token **OPEN**.
> Treat every copy of this project outside the working directory (Desktop
> duplicates, zip archives, worktrees) as contaminated until deleted.

1. ~~Supabase dashboard → project Settings → API → Rotate service_role key.~~ DONE.
2. ~~Update every consumer of the service key.~~ DONE (no infrastructure held it).
3. Search the machine for leftovers:
   ```bash
   grep -rl "sb_secret_" ~/Desktop ~/Documents 2>/dev/null
   ```
   Delete any hit, then empty Trash. Prefer deleting whole duplicate project
   folders over editing individual files.
4. Git history still contains the old key literals. Decision (patch 0.3):
   **leave history as-is** — both keys are verified dead and the repo is
   public; a history rewrite would invalidate every commit hash for no
   remaining exposure. Revisit only if a live key ever lands in history
   (`git filter-repo --replace-text` + force-push, then re-clone).
5. ~~Audit Dashboard → Logs → API for requests authenticated with the old key.~~
   No unexpected activity observed; key verified dead.
6. Rotate the **management access token** (Account → Access Tokens). After
   rotation, verify the old token returns 401 against `api.supabase.com`.

## Security posture notes (patch 0.2)

- CSP is now nonce-based in production (`script-src 'nonce-…' 'strict-dynamic'`).
  If a third-party script is added later, it must load via a trusted loader,
  not an inline tag.
- `/admin/*` requires the `analyst` or `admin` role at the middleware layer;
  API routes additionally enforce `requireAdmin()` server-side.
- Rate limiting no longer trusts `x-forwarded-for` unless `TRUST_PROXY=true`
  is set in the environment (only correct behind a known proxy).
- Stripe webhook rejects malformed payloads with 400 (no retry storms) and
  only maps price IDs from the configured allowlist environment variables.

## Database lockdown (patch 0.3 — 2026-10-07)

Migration `supabase/migrations/20261007_security_overhaul.sql` closed the
findings from the October 2026 audit:

- **RLS enabled on every public table** — previously 28 core tables
  (`countries`, `budgets`, `contracts`, `companies`, `data_changes`, …) had
  row security fully disabled while the publishable anon key (public in the
  browser bundle) held INSERT/UPDATE/DELETE. Anyone could have rewritten or
  wiped the intelligence dataset through the REST API.
- **Anon write privileges revoked everywhere**; the only anon INSERT grants
  left are the consent-based intake tables (`user_survey_responses`,
  `privacy_requests`, `anonymous_search_logs`) under insert-only policies.
- **All 68 public views flipped to `security_invoker`** — they previously ran
  with owner privileges (SECURITY DEFINER default), bypassing row security.
- **SECURITY DEFINER functions hardened**: `promote_bulk_import_job` and
  `materialise_conflicts` no longer executable by anonymous callers; blanket
  PUBLIC execute grants revoked; `search_path` pinned on 8 helper functions.
- **Missing promised tables created** (`user_survey_responses`,
  `privacy_requests`, `anonymous_search_logs`, `rate_limit_counters` + RPCs,
  `profiles` with a signup trigger) — the privacy notice's claims about
  search analytics, survey storage, GDPR request intake and RLS protection
  are now true.
- **Stripe webhook switched to a server-only service-role client**
  (`lib/supabase/admin.ts`); subscription and role writes previously ran as
  anon and would have failed silently under RLS.
- **CI scans committed files for key-shaped secrets** (working-tree scan —
  full-history scanning is deferred; see runbook decision above).

Verified: `PATCH /rest/v1/countries` → 401 with the anon key; intake POSTs
→ 201; Supabase security advisor no longer reports `rls_disabled_in_public`
(28) or `security_definer_view` (68).

## Hardening pass (patch 0.4 — 2026-10-05)

- **Next.js upgraded 16.3.4 → 16.3.8** — fixes GHSA-vcvr-r3jv-pc5j (critical,
  RCE in `next/og` ImageResponse). The app does not import `next/og`, so the
  vulnerable code was never reachable, but the patched version removes the
  dependency risk entirely.
- **Rate limiting is now database-primary for API routes** (`dbRateLimit`):
  counters live in `rate_limit_counters` and hold across restarts and
  instances; the per-instance in-memory limiter is the fallback for database
  outages. Previously `/api/satellites`, `/api/survey` and `/api/opt-out`
  counted only in memory — a restart reset every attacker's budget to zero.
- **Rate-limit RPCs hardened** (migration `20261008_rate_limit_rpc_hardening.sql`):
  `increment_rate_limit` validates its key (1–200 chars of
  `[A-Za-z0-9._:/@-]`) and window (1s–24h), so the public anon key can no
  longer flood the counter table or inflate guessed keys to lock others out;
  `advance_rate_limit_window` trims every row older than 24h.
- **Legal placeholders resolved**: operator identity and contact email are
  published on /terms, /privacy and /data-licences (previously
  `[INSERT …]` placeholders — a compliance gap for a privacy notice).
- **Auth signup trigger hardened**: `handle_new_user()` EXECUTE revoked from
  anon/authenticated/PUBLIC (trigger firing ignores EXECUTE grants, so this
  only closes the direct-RPC surface flagged by the advisor).
- **Residual (accepted)**: 5 high-severity advisories in dev-only lint
  tooling (`braces`/`micromatch` via eslint-config-next) — DoS on
  adversarial glob patterns that never occur in lint input;
  `npm audit --omit=dev` (production deps) is clean. Leaked-password
  protection must be enabled in the Supabase dashboard — the management
  token lacks `auth_config_write` (403).

Verified: malformed RPC calls → 400 `invalid rate limit parameters`; valid
keys still count; survey limiter 200×5 → 429 and still 429 after a server
restart (counter survived via the database); `handle_new_user` EXECUTE now
false for anon/authenticated; typecheck/eslint/build green; 13/13 smoke.
