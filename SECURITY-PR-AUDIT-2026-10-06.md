# Four-Dimension Audit — Security PRs #3, #4, #5 (2026-10-06)

Audit of the three security PRs as merged on `main`:

- **PR #3** `576979a` — security overhaul / DB lockdown (patch 0.3): 10 files,
  +520/−47, centred on `20261007_security_overhaul.sql` (358 lines).
- **PR #4** `58abc07` — hardening patch 0.4: 12 files, +220/−75 (CVE bump,
  DB-primary rate limiting, RPC hardening migration, legal identity).
- **PR #5** `d4e1fe2` — follow-up: 3 files, +23/−8 (`handle_new_user` EXECUTE
  revoke + synced migration file, SECURITY.md residuals, lockfile bump).

Dimensions: **(1) Threat-model effectiveness** — does it close the exposure it
claims to; **(2) Completeness** — what it leaves open; **(3) Correctness &
regression risk** — bugs introduced; **(4) Operability & maintainability** —
can it be verified, reverted, and kept true over time. Evidence is today's
live re-verification (advisors + anon probes + header audit), not just the
diffs.

## PR #3 — DB lockdown

1. **Effectiveness: strong.** The headline claim — 28 public tables with RLS
   fully disabled while the publishable key held write grants — was a true
   unauthenticated-wipe primitive; it is closed and *stays* closed: today's
   anon POST/PATCH/DELETE on `countries`, `budgets`, `contracts`,
   `companies`, `profiles` all fail with `permission denied`, and a value-level
   UPDATE attempt leaves the row unchanged. The 68 `security_invoker` view
   flips closed the parallel definer-view bypass (advisor
   `security_definer_view` 68 → 0 and still 0). Intake tables
   (`user_survey_responses`, `privacy_requests`, `anonymous_search_logs`)
   went from promised-but-nonexistent to insert-only with hashed session
   linkage — the privacy notice became true rather than aspirational.
2. **Completeness: honest gaps, documented.** Rate-limit counters RPCs were
   left anon-callable (necessary for the app's own limiter) — validated and
   later hardened in #4; org-helper SECURITY DEFINER functions remain
   authenticated-callable because they are load-bearing inside RLS policies —
   flagged by the advisor, consciously accepted in SECURITY.md.
3. **Correctness: low regression risk.** The one-shot migration is idempotent
   (`drop policy if exists` / `grant` statements), and the Stripe webhook's
   move to a server-only service-role client fixed a silent-write bug the RLS
   change would otherwise have created. Risk carried forward: the migration's
   grant matrix is a living configuration — before #5/#4 the working-tree
   secret scan was the only automated guard, and nothing asserted the DB
   posture *stayed* put (closed by this sweep's nightly probes).
4. **Operability: good docs, weak automation (at the time).** SECURITY.md
   records both incident remediation and accepted residuals. Verification was
   manual; today the same assertions run nightly (`scripts/security-probe.sh`).

## PR #4 — hardening 0.4

1. **Effectiveness: strong.** In-memory rate limiting resetting on restart
   was a real availability control failure (proved by a 429 that survived a
   full server restart only after the DB-backed limiter). The key-validation
   RPC hardening closed a genuine counter-flood vector via the publishable
   key (400 `invalid rate limit parameters` still verified today). The
   Next.js CVE bump removed the only prod-dependency exposure (`next/og` was
   unreachable, but unpatchable-by-config).
2. **Completeness: the fail-open seam is deliberate and documented.** When the
   RPCs are missing (fresh environment, PGRST202) limiting degrades to
   per-instance memory — a reasonable availability trade that means the
   *security* property is environment-dependent; the nightly probe now
   asserts the RPCs exist and validate, so drift fails a build.
3. **Correctness: one subtlety.** `dbRateLimit` consults `advance_rate_limit_window`
   then `increment_rate_limit` as two calls (not one transaction) — a racing
   client can slightly exceed the nominal limit under contention; acceptable
   for abuse control (not billing). Module-level env capture
   (`STRIPE_WEBHOOK_SECRET` const) means env changes need a restart —
   observed live this sweep (see audit F2).
4. **Operability: good.** Legal identity replaced placeholders (compliance
   gap closed), residuals explicitly listed with severity rationale.

## PR #5 — follow-up

1. **Effectiveness: correct and complete for its scope.** `handle_new_user`
   EXECUTE revoked from anon/authenticated/PUBLIC — the direct-RPC surface
   the advisor flagged is gone (trigger execution is unaffected). Migration
   file synced so fresh environments match live. Verified today via
   `has_function_privilege` (false) and the advisor set.
2. **Completeness: scoped correctly** — SECURITY.md records the dev-dep
   residual instead of downgrading Next to fix lint-tool advisories (right
   call; `npm audit --omit=dev` clean then and now, with the new
   `source-map-js` advisory since patched non-breakingly).
3. **Correctness: no risk** — a revoke + doc + lockfile.
4. **Operability: good** — residuals became the allowlist this sweep's
   advisor gate encodes mechanically (a vanished finding now prompts cleanup
   of the allowlist; a new one fails the build).

## Cross-cutting residuals (unchanged by these PRs, tracked in SECURITY-AUDIT-2026-10-06.md)

- Leaked-password protection (dashboard-only) — the last advisor WARN family
  without a code fix.
- Service-role key / Stripe price IDs unminted → webhook inert; webhook now
  also fails closed without leaking config state.
- Read endpoints without DB-backed limits; fingerprint-rotatable limiter keys
  until `TRUST_PROXY=true` behind the edge proxy.
- Rate-limit RPC row-minting bounded but possible (by design, trimmed 24 h).

## Verdict

All three PRs do what they claim, with claims verified externally today and
now continuously enforced by nightly CI. The honest gaps are documented
rather than hidden, and the biggest process weakness these PRs shared —
manual, one-off verification of a *configuration* posture that can silently
drift — is closed by this sweep's probe suite and advisor allowlist.
