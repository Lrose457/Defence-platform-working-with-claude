-- Security overhaul (Phase 1) — 2026-10-07
--
-- Findings remediated (see SECURITY.md patch 0.3):
--   S1  RLS disabled on core intelligence tables while the publishable anon
--       key (public in the browser bundle) held INSERT/UPDATE/DELETE.
--   S2  Views in `public` default to SECURITY DEFINER (owner rights), which
--       bypassed row security on the tables they selected from.
--   S3  SECURITY DEFINER RPCs executable by `anon`.
--   S4  Tables promised by the privacy notice / used by app code did not
--       exist: user_survey_responses, privacy_requests, anonymous_search_logs,
--       rate_limit_counters (+ RPCs), profiles.
--
-- Design:
--   * Intelligence data stays world-readable (it is a public research
--     platform) but becomes read-only: anon loses every write privilege,
--     authenticated keeps only the writes its policies already define.
--   * All views become `security_invoker` so row security of the *querying*
--     role applies; public-read policies on the base tables keep the site
--     working.
--   * The service_role key used by the ingestion pipeline has BYPASSRLS and
--     is unaffected.
--
-- Idempotent: safe to re-run. Wrapped in one transaction: any failure rolls
-- the whole lockdown back rather than leaving the database half-protected.

begin;

---------------------------------------------------------------------------
-- 1) Core intelligence tables: enable RLS + public read-only policy
---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'budgets',
    'companies',
    'company_equipment',
    'company_sources',
    'contract_equipment',
    'contracts',
    'countries',
    'country_equipment',
    'data_changes',
    'equipment',
    'equipment_companies',
    'government_spending',
    'government_spending_categories',
    'government_spending_categories_staging',
    'people',
    'plan_features',
    'procurement_events',
    'programme_companies',
    'programme_contracts',
    'programme_equipment',
    'programme_events',
    'programme_sources',
    'programmes',
    'role_tenures',
    'sipri_country_mapping',
    'source_verifications',
    'sources',
    'subscription_plans'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and cmd = 'SELECT'
    ) then
      execute format(
        'create policy %I on public.%I for select to public using (true)',
        'Public can read ' || t,
        t
      );
    end if;
  end loop;
end $$;

---------------------------------------------------------------------------
-- 2) Write privileges: deny-by-default
--
--    anon: no legitimate direct writes anywhere (the three intake tables
--          below get explicit INSERT policies instead).
--    authenticated: writes are revoked only where RLS was just enabled —
--          tables that already carry policies keep their existing grants,
--          so admin/analyst flows keep working.
---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.relname, c.relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v')
  loop
    execute format(
      'revoke insert, update, delete on public.%I from anon',
      r.relname
    );

    if r.relkind = 'v' then
      -- Views: revoke writes from both roles. Simple views are
      -- auto-updatable, so their write grants were a second, unpoliced
      -- path into the base tables.
      execute format(
        'revoke insert, update, delete on public.%I from authenticated',
        r.relname
      );
    end if;
  end loop;
end $$;

---------------------------------------------------------------------------
-- 3) Views: enforce the querying role's row security
--
--    Closes the SECURITY DEFINER view class (advisor: security_definer_view).
--    Public-read policies added in step 1 (and pre-existing policies on the
--    newer tables) keep every public page working after the flip.
---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
  loop
    execute format(
      'alter view public.%I set (security_invoker = true)',
      r.relname
    );
  end loop;
end $$;

---------------------------------------------------------------------------
-- 4) SECURITY DEFINER functions
--
--    * promote_bulk_import_job is invoked by no application code — revoke
--      from anon and authenticated.
--    * materialise_conflicts is called server-side by the admin-gated
--      ingestion review route as the signed-in user, so authenticated
--      keeps EXECUTE (accepted, documented risk).
--    * is_platform_admin / is_organisation_member / user_belongs_to_
--      organisation are referenced by RLS policies on organisation tables,
--      which execute as the querying user — authenticated keeps EXECUTE.
---------------------------------------------------------------------------
revoke execute on function public.promote_bulk_import_job(bigint)
  from anon, authenticated, public;
revoke execute on function public.materialise_conflicts(bigint[]) from anon;

-- The helpers below carried a blanket PUBLIC execute grant (`=X/…`). Revoke
-- from PUBLIC, then re-grant to authenticated explicitly: RLS policies on
-- the organisation tables invoke these as the querying (authenticated) role.
-- `handle_new_user` is trigger-only and needs no EXECUTE grant at all.
revoke execute on function public.is_platform_admin() from public;
revoke execute on function public.is_organisation_member(bigint) from public;
revoke execute on function public.user_belongs_to_organisation(bigint) from public;
revoke execute on function public.handle_new_user() from public;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_organisation_member(bigint) to authenticated;
grant execute on function public.user_belongs_to_organisation(bigint) to authenticated;

-- Pin search_path on the trigger/helper functions the advisor flagged
-- (search_path must be role-immutable inside SECURITY DEFINER bodies).
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proconfig is null
      and p.proname in (
        'record_intelligence_update',
        'record_programme_equipment_change',
        'record_programme_company_change',
        'record_country_equipment_change',
        'record_contract_equipment_change',
        'country_id_from_iso',
        'country_matches_hint',
        'set_updated_at'
      )
  loop
    execute format('alter function %s set search_path = ''public''', r.fn);
  end loop;
end $$;

---------------------------------------------------------------------------
-- 5) Tables the platform already promises (privacy notice, /api/survey,
--    /api/opt-out, lib/security/searchLog.ts, rateLimitDb.ts, webhook)
---------------------------------------------------------------------------

-- 5a. Anonymous survey responses (consent-based; insert-only for visitors).
create table if not exists public.user_survey_responses (
  id bigint generated always as identity primary key,
  role text not null,
  organisation_type text,
  benefit text not null,
  comments text,
  anonymous_session_hash text,
  created_at timestamptz not null default now()
);
alter table public.user_survey_responses enable row level security;
drop policy if exists "visitors can submit survey responses"
  on public.user_survey_responses;
create policy "visitors can submit survey responses"
  on public.user_survey_responses
  for insert to anon, authenticated with check (true);
revoke select, update, delete on public.user_survey_responses
  from anon, authenticated;

-- 5b. GDPR / UK DPA request intake (insert-only for visitors; processed
--     server-side with the service role, which bypasses RLS).
create table if not exists public.privacy_requests (
  id bigint generated always as identity primary key,
  request_type text not null default 'opt_out',
  name text not null,
  email text not null,
  details text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
alter table public.privacy_requests enable row level security;
drop policy if exists "visitors can submit privacy requests"
  on public.privacy_requests;
create policy "visitors can submit privacy requests"
  on public.privacy_requests
  for insert to anon, authenticated with check (true);
revoke select, update, delete on public.privacy_requests
  from anon, authenticated;

-- 5c. Anonymous search analytics — salted hashes only (see
--     lib/security/searchLog.ts and privacy notice section 2).
create table if not exists public.anonymous_search_logs (
  id bigint generated always as identity primary key,
  session_hash text not null,
  query_hash text not null,
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.anonymous_search_logs enable row level security;
drop policy if exists "visitors can record search analytics"
  on public.anonymous_search_logs;
create policy "visitors can record search analytics"
  on public.anonymous_search_logs
  for insert to anon, authenticated with check (true);
revoke select, update, delete on public.anonymous_search_logs
  from anon, authenticated;

-- 5d. Distributed rate-limit counters. No direct grants: only the two
--     SECURITY DEFINER RPCs below touch this table (they run as the owner).
create table if not exists public.rate_limit_counters (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.rate_limit_counters enable row level security;
revoke all on public.rate_limit_counters from anon, authenticated;

create or replace function public.increment_rate_limit(
  p_key text,
  p_window_ms bigint
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.rate_limit_counters as rlc (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    count = case
      when rlc.window_start < now() - make_interval(secs => p_window_ms / 1000.0)
        then 1
      else rlc.count + 1
    end,
    window_start = case
      when rlc.window_start < now() - make_interval(secs => p_window_ms / 1000.0)
        then now()
      else rlc.window_start
    end,
    updated_at = now()
  returning count into v_count;

  return v_count;
end $$;

create or replace function public.advance_rate_limit_window(
  p_key text,
  p_window_ms bigint
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limit_counters
  where window_start < now() - make_interval(secs => p_window_ms / 1000.0);
$$;

grant execute on function public.increment_rate_limit(text, bigint)
  to anon, authenticated;
grant execute on function public.advance_rate_limit_window(text, bigint)
  to anon, authenticated;

-- 5e. Profiles — webhook checkout resolves users by email here.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  stripe_customer_id text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "users can view own profile" on public.profiles;
create policy "users can view own profile"
  on public.profiles
  for select to authenticated
  using (id = auth.uid());

revoke insert, update, delete on public.profiles from anon, authenticated;

insert into public.profiles (id, email)
select u.id, u.email from auth.users u
on conflict (id) do nothing;

-- Keep profiles in sync for future signups.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

commit;
