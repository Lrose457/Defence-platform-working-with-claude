# Security Incident Report — Service Role Key Exposure

## Summary

A Supabase **service_role key** (`sb_secret_DVdE4NSE2w2_Rm7NIordRA_YKgmMmwq`) was
committed to the repository in a stray file named `NEXT_PUBLIC_SUPABASE_ANON_KEY=`
at the project root. The filename falsely implied it was a publishable anon key;
it was in fact a privileged service_role key with full database access.

The file has been **deleted** and added to `.gitignore`. The legitimate anon key
in `.env.local` (`sb_publishable_ibteOGpGrSB-8a4u_hgdrw_Aa1166mg`) was not affected.

## Immediate Actions Taken

1. ✅ Deleted the stray file `NEXT_PUBLIC_SUPABASE_ANON_KEY=` (contained `sb_secret_…`).
2. ✅ Deleted the stray file `NEXT_PUBLIC_SUPABASE_URL=` (contained a dashboard URL).
3. ✅ Added both file-name patterns to `.gitignore` to prevent re-creation.
4. ✅ Verified `.env.local` uses the correct publishable anon key, not the service_role key.

## Actions Required (Manual)

1. **Rotate the leaked service_role key immediately** — generate a new service_role
   key in the Supabase dashboard and revoke the old one. Any infrastructure that
   references the old key (data pipeline, cron jobs, backend scripts) must be
   updated with the new value.
2. **Rotate the publishable anon key** as a precaution, since the project
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` pattern was co-opted for the stray file.
3. **Audit Supabase access logs** for the window during which the key was exposed.

## Key-Rotation Runbook (patch 0.2)

> Status: **OPEN — rotation has not yet been performed.** Treat every copy of
> this project outside the working directory (Desktop duplicates, zip archives,
> worktrees) as contaminated until deleted.

1. Supabase dashboard → project **Settings → API**.
2. Under **service_role / secret keys**, choose **Rotate**: a new secret is
   generated and the old one stops working immediately (the anon/publishable
   key is unaffected).
3. Update every consumer of the service key:
   - data-pipeline jobs (`.venv` env / scheduled tasks)
   - any local scripts that used the old key
4. Search the machine for leftovers:
   ```bash
   grep -rl "sb_secret_" ~/Desktop ~/Documents 2>/dev/null
   ```
   Delete any hit, then empty Trash. Prefer deleting whole duplicate project
   folders over editing individual files.
5. Git history still contains the old key. Either run history purging
   (`git filter-repo --replace-text`) and force-push, or — if the repo was
   never pushed/shared — leave history as-is once the key is confirmed dead
   and the repo stays private.
6. Audit **Dashboard → Logs → API** for requests authenticated with the old
   key before rotation; note any unexpected IP addresses.
7. Update `.env.local`-style files everywhere the service key is used, then
   re-run the ingestion pipeline once to confirm.

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
