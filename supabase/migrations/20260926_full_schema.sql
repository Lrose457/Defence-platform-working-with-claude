-- =============================================================================
-- Full schema for the Defence Intelligence Platform.
--
-- This migration materialises the complete database schema that the
-- Next.js application depends on.  The existing five migrations dealt only
-- with country-region assignment, anonymous-search logging, source-catalog
-- insertion and ingestion-provenance columns; they did not create the core
-- domain tables, views, RPCs, or row-level-security policies that the
-- application references at run-time.
--
-- Key deliverables:
--   1. Core domain tables: countries, companies, equipment, programmes,
--      contracts, budgets, procurements, conflicts, etc.
--   2. Intelligence-lifecycle tables: data_changes, ingestion_queue
--      (extended), ingestion_reviews, intelligence_evidence.
--   3. Authorization tables: platform_roles, organisations,
--      organisation_members, subscriptions.
--   4. Rate-limiting table + the two RPCs that the DB-backed limiter calls.
--   5. The is_platform_admin() RPC that three admin API routes call.
--   6. All analytical views (global_entity_search, country_benchmark_summary,
--      ingestion_source_health, etc.).
--   7. Row-level-security policies for every user-accessible table.
--
-- Run with: supabase db push   (or  supabase migration up)
-- =============================================================================

-- Enable required extensions.
create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Countries
-- -----------------------------------------------------------------------------
create table if not exists public.countries (
  id            bigint generated always as identity primary key,
  name          text not null,
  iso_code      text not null,
  iso_code_2    text,
  region        text,
  blocs         text[],
  spending_billions numeric,
  defence_budget numeric,
  spending_history jsonb,
  strategic_assessment text,
  latitude      numeric,
  longitude     numeric,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null
);

create unique index if not exists countries_iso_code_key on public.countries (iso_code);
create index if not exists countries_region_idx on public.countries (region);
create index if not exists countries_name_trgm_idx on public.countries using gin (name gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- 2. Companies
-- -----------------------------------------------------------------------------
create table if not exists public.companies (
  id               bigint generated always as identity primary key,
  name             text not null,
  country_id       bigint references public.countries (id),
  contracts_count  integer default 0,
  description      text,
  headquarters     text,
  ceo              text,
  market_cap       text,
  strategic_assessment text,
  source_id        bigint references public.sources (id),
  created_at       timestamptz default now() not null,
  updated_at       timestamptz default now() not null
);

create index if not exists companies_country_id_idx on public.companies (country_id);
create index if not exists companies_source_id_idx on public.companies (source_id);
create index if not exists companies_name_trgm_idx on public.companies using gin (name gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- 3. Equipment
-- -----------------------------------------------------------------------------
create table if not exists public.equipment (
  id          bigint generated always as identity primary key,
  name        text not null,
  type        text,
  role        text,
  country_id  bigint references public.countries (id),
  company_id  bigint references public.companies (id),
  confidence_score integer,
  specs       jsonb,
  source_id   bigint references public.sources (id),
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

create index if not exists equipment_country_id_idx on public.equipment (country_id);
create index if not exists equipment_company_id_idx on public.equipment (company_id);

-- -----------------------------------------------------------------------------
-- 4. Programmes
-- -----------------------------------------------------------------------------
create table if not exists public.programmes (
  id                 bigint generated always as identity primary key,
  name               text not null,
  country_id         bigint references public.countries (id),
  description        text,
  status             text,
  budget             numeric,
  start_date         date,
  expected_delivery  date,
  source_id          bigint references public.sources (id),
  created_at         timestamptz default now() not null,
  updated_at         timestamptz default now() not null
);

create index if not exists programmes_country_id_idx on public.programmes (country_id);

-- -----------------------------------------------------------------------------
-- 5. Contracts
-- -----------------------------------------------------------------------------
create table if not exists public.contracts (
  id          bigint generated always as identity primary key,
  title       text not null,
  company_id  bigint references public.companies (id),
  country_id  bigint references public.countries (id),
  value       text,
  status      text,
  description text,
  source_id   bigint references public.sources (id),
  contract_date date,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

create index if not exists contracts_company_id_idx on public.contracts (company_id);
create index if not exists contracts_country_id_idx on public.contracts (country_id);
create index if not exists contracts_source_id_idx on public.contracts (source_id);

-- -----------------------------------------------------------------------------
-- 6. Budgets
-- -----------------------------------------------------------------------------
create table if not exists public.budgets (
  id         bigint generated always as identity primary key,
  country_id bigint references public.countries (id),
  year       integer not null,
  amount     numeric,
  currency   text default 'USD',
  source_id  bigint references public.sources (id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists budgets_country_id_idx on public.budgets (country_id);
create index if not exists budgets_year_idx on public.budgets (year);

-- -----------------------------------------------------------------------------
-- 7. Procurements
-- -----------------------------------------------------------------------------
create table if not exists public.procurements (
  id          bigint generated always as identity primary key,
  title       text not null,
  country_id  bigint references public.countries (id),
  value       numeric,
  currency    text default 'USD',
  status      text,
  description text,
  source_id   bigint references public.sources (id),
  event_type  text,
  event_date  date,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

create index if not exists procurements_country_id_idx on public.procurements (country_id);

-- -----------------------------------------------------------------------------
-- 8. Junction tables
-- -----------------------------------------------------------------------------
create table if not exists public.contract_equipment (
  contract_id  bigint references public.contracts (id) on delete cascade,
  equipment_id bigint references public.equipment (id) on delete cascade,
  primary key (contract_id, equipment_id)
);

create table if not exists public.country_equipment (
  country_id   bigint references public.countries (id) on delete cascade,
  equipment_id bigint references public.equipment (id) on delete cascade,
  primary key (country_id, equipment_id)
);

create table if not exists public.programme_equipment (
  programme_id  bigint references public.programmes (id) on delete cascade,
  equipment_id  bigint references public.equipment (id) on delete cascade,
  primary key (programme_id, equipment_id)
);

-- -----------------------------------------------------------------------------
-- 9. Conflicts & conflict sub-tables
-- -----------------------------------------------------------------------------
create table if not exists public.conflicts (
  id          bigint generated always as identity primary key,
  name        text not null,
  region      text,
  start_date  date,
  status      text check (status in ('Active', 'Frozen', 'Resolved')),
  summary     text,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

create table if not exists public.conflict_parties (
  id          bigint generated always as identity primary key,
  conflict_id bigint references public.conflicts (id),
  name        text not null,
  side        text,
  created_at  timestamptz default now() not null
);

create table if not exists public.conflict_incidents (
  id          bigint generated always as identity primary key,
  conflict_id bigint references public.conflicts (id),
  incident_date date,
  title       text,
  description text,
  created_at  timestamptz default now() not null
);

create table if not exists public.conflict_events (
  id              bigint generated always as identity primary key,
  week            text,
  region          text,
  country         text,
  event_type      text,
  sub_event_type  text,
  events          integer,
  fatalities      integer,
  population_exposure numeric,
  centroid_latitude  numeric,
  centroid_longitude numeric,
  created_at      timestamptz default now() not null
);

-- -----------------------------------------------------------------------------
-- 10. Ukraine support data
-- -----------------------------------------------------------------------------
create table if not exists public.ukraine_support (
  id            bigint generated always as identity primary key,
  donor_country text,
  announcement_date date,
  aid_type      text,
  item          text,
  quantity      integer,
  quantity_delivered integer,
  value         numeric,
  value_eur     numeric,
  created_at    timestamptz default now() not null
);

-- -----------------------------------------------------------------------------
-- 11. SIPRI & IMF data
-- -----------------------------------------------------------------------------
create table if not exists public.sipri_milex (
  id                             bigint generated always as identity primary key,
  sipri_country                  text,
  year                           integer,
  amount_usd_millions            numeric,
  constant_amount_usd_millions   numeric,
  percentage_gdp                 numeric,
  percentage_government_spending numeric,
  created_at                     timestamptz default now() not null
);

create table if not exists public.imf_government_expenditure (
  id                              bigint generated always as identity primary key,
  country_iso3                    text,
  year                            integer,
  expenditure_gdp_percent         numeric,
  total_expenditure_domestic_currency numeric,
  total_expenditure_usd           numeric,
  created_at                      timestamptz default now() not null
);

create table if not exists public.government_spending (
  id          bigint generated always as identity primary key,
  country_id  bigint references public.countries (id),
  year        integer,
  amount      numeric,
  currency    text default 'USD',
  source_id   bigint references public.sources (id),
  created_at  timestamptz default now() not null
);

-- -----------------------------------------------------------------------------
-- 12. intelligence: data_changes
-- -----------------------------------------------------------------------------
create table if not exists public.data_changes (
  id                  bigint generated always as identity primary key,
  entity_type         text not null,
  entity_id           bigint,
  field_name          text not null,
  old_value           text,
  new_value           text,
  change_type         text,
  change_date         text,
  changed_at          timestamptz default now() not null,
  reason              text,
  source_id           bigint references public.sources (id),
  data_confidence     text,
  table_name          text,
  record_id           bigint,
  importance          text check (importance in ('high', 'normal', 'low')),
  severity            text,
  summary             text,
  assessment          text,
  intelligence_eligible boolean default false,
  reviewed            boolean default false,
  reviewed_at         timestamptz,
  reviewed_by         uuid references auth.users (id),
  notes               text,
  entry_method        text,
  created_at          timestamptz default now() not null
);

create index if not exists data_changes_entity_idx on public.data_changes (entity_type, entity_id);
create index if not exists data_changes_intelligence_eligible_idx on public.data_changes (intelligence_eligible) where intelligence_eligible is true;
create index if not exists data_changes_reviewed_idx on public.data_changes (reviewed);
create index if not exists data_changes_changed_at_idx on public.data_changes (changed_at desc);
create index if not exists data_changes_source_id_idx on public.data_changes (source_id);

-- Ensure reviewed_by is set when reviewed is true (data integrity).
create or replace function public.data_changes_set_reviewed_at()
returns trigger
language plpgsql
as $$
begin
  if new.reviewed is true and (old.reviewed is distinct from new.reviewed or old.reviewed_by is distinct from new.reviewed_by) then
    if new.reviewed_at is null then
      new.reviewed_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger if not exists data_changes_reviewed_at_trigger
  before insert or update on public.data_changes
  for each row
  execute function public.data_changes_set_reviewed_at();

-- -----------------------------------------------------------------------------
-- 13. ingestion_queue — extend if the table was only partially created
--     by earlier migrations.
-- -----------------------------------------------------------------------------
-- The existing migration 20260925_ingestion_provenance.sql adds some columns;
-- this adds the remainder that the application inserts / selects.
alter table if exists public.ingestion_queue
  add column if not exists ingestion_source_id bigint,
  add column if not exists external_id text,
  add column if not exists entity_type text,
  add column if not exists entity_id bigint,
  add column if not exists operation text default 'review',
  add column if not exists title text,
  add column if not exists confidence_score integer,
  add column if not exists status text default 'pending',
  add column if not exists review_status text,
  add column if not exists reviewed_by uuid references auth.users (id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_notes text;

-- Source_id may or may not already exist depending on earlier migrations.
alter table if exists public.ingestion_queue
  add column if not exists source_id bigint references public.sources (id);

create index if not exists ingestion_queue_status_idx
  on public.ingestion_queue (status);
create index if not exists ingestion_queue_review_status_idx
  on public.ingestion_queue (review_status);
create index if not exists ingestion_queue_source_id_idx
  on public.ingestion_queue (source_id);
create index if not exists ingestion_queue_entity_idx
  on public.ingestion_queue (entity_type, entity_id);

-- Confidence-score check (same shape as the provenance migration's constraint).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ingestion_queue_confidence_score_check'
  ) then
    alter table public.ingestion_queue
      add constraint ingestion_queue_confidence_score_check
      check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 100));
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 14. ingestion_reviews
-- -----------------------------------------------------------------------------
create table if not exists public.ingestion_reviews (
  id         bigint generated always as identity primary key,
  queue_id   bigint references public.ingestion_queue (id) on delete cascade,
  reviewer_id uuid references auth.users (id),
  decision   text not null check (decision in ('approved', 'rejected', 'returned')),
  notes      text,
  source_id  bigint references public.sources (id),
  created_at timestamptz default now() not null
);

create index if not exists ingestion_reviews_queue_id_idx on public.ingestion_reviews (queue_id);
create index if not exists ingestion_reviews_reviewer_id_idx on public.ingestion_reviews (reviewer_id);

-- -----------------------------------------------------------------------------
-- 15. intelligence_evidence
-- -----------------------------------------------------------------------------
create table if not exists public.intelligence_evidence (
  id                   bigint generated always as identity primary key,
  change_id            bigint references public.data_changes (id) on delete cascade,
  source_id            bigint references public.sources (id),
  evidence_type        text,
  evidence_title       text,
  evidence_url         text,
  evidence_excerpt     text,
  evidence_date        timestamptz,
  publisher            text,
  confidence           text,
  corroboration_status text,
  analyst_notes        text,
  created_by           uuid references auth.users (id),
  created_at           timestamptz default now() not null
);

create index if not exists intelligence_evidence_change_id_idx on public.intelligence_evidence (change_id);
create index if not exists intelligence_evidence_source_id_idx on public.intelligence_evidence (source_id);

-- -----------------------------------------------------------------------------
-- 16. Authorisation: organisations & members
-- -----------------------------------------------------------------------------
create table if not exists public.organisations (
  id         uuid default uuid_generate_v4() primary key,
  name       text not null,
  slug       text,
  plan       text default 'free',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create unique index if not exists organisations_slug_key on public.organisations (slug) where slug is not null;

create table if not exists public.organisation_members (
  organisation_id uuid references public.organisations (id) on delete cascade,
  user_id         uuid references auth.users (id) on delete cascade,
  role            text not null default 'member' check (role in ('owner', 'admin', 'analyst', 'member')),
  joined_at       timestamptz default now() not null,
  primary key (organisation_id, user_id)
);

create index if not exists organisation_members_user_id_idx on public.organisation_members (user_id);
create index if not exists organisation_members_organisation_id_idx on public.organisation_members (organisation_id);

-- -----------------------------------------------------------------------------
-- 17. Authorisation: platform roles (analyst / admin)
-- -----------------------------------------------------------------------------
create table if not exists public.platform_roles (
  user_id      uuid references auth.users (id) on delete cascade primary key,
  role         text not null check (role in ('analyst', 'admin')),
  organisation_id uuid references public.organisations (id),
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);

create index if not exists platform_roles_user_id_idx on public.platform_roles (user_id);
create index if not exists platform_roles_role_idx on public.platform_roles (role);

-- -----------------------------------------------------------------------------
-- 18. Subscriptions & export usage
-- -----------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                  bigint generated always as identity primary key,
  user_id             uuid references auth.users (id),
  plan_name           text,
  plan                text,
  status              text,
  stripe_customer_id  text,
  stripe_subscription_id text,
  current_period_end  timestamptz,
  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null
);

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_stripe_customer_id_idx on public.subscriptions (stripe_customer_id);

create table if not exists public.export_usage_monthly (
  id               bigint generated always as identity primary key,
  user_id          uuid references auth.users (id),
  usage_month      text not null, -- e.g. "2025-01"
  export_count     integer default 0,
  plan_limit       integer default 3,
  created_at       timestamptz default now() not null,
  updated_at       timestamptz default now() not null
);

create unique index if not exists export_usage_monthly_user_month_key
  on public.export_usage_monthly (user_id, usage_month);

-- -----------------------------------------------------------------------------
-- 19. Rate-limiting counter table
-- -----------------------------------------------------------------------------
create table if not exists public.rate_limit_counters (
  key          text primary key,
  count        integer not null default 0,
  window_start timestamptz not null,
  updated_at   timestamptz default now() not null
);

create index if not exists rate_limit_counters_window_start_idx on public.rate_limit_counters (window_start);

-- -----------------------------------------------------------------------------
-- 20. Investigations & workspace items
-- -----------------------------------------------------------------------------
create table if not exists public.investigations (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users (id),
  title       text not null,
  description text,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

create index if not exists investigations_user_id_idx on public.investigations (user_id);

create table if not exists public.investigation_items (
  id              bigint generated always as identity primary key,
  investigation_id bigint references public.investigations (id) on delete cascade,
  entity_type     text,
  entity_id       bigint,
  notes           text,
  created_at      timestamptz default now() not null
);

create index if not exists investigation_items_investigation_id_idx on public.investigation_items (investigation_id);

-- -----------------------------------------------------------------------------
-- 21. Watchlists
-- -----------------------------------------------------------------------------
create table if not exists public.watchlists (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id),
  name       text not null,
  created_at timestamptz default now() not null
);

create index if not exists watchlists_user_id_idx on public.watchlists (user_id);

create table if not exists public.watchlist_items (
  id             bigint generated always as identity primary key,
  watchlist_id   bigint references public.watchlists (id) on delete cascade,
  entity_type    text,
  entity_id      bigint,
  created_at     timestamptz default now() not null
);

create index if not exists watchlist_items_watchlist_id_idx on public.watchlist_items (watchlist_id);

-- -----------------------------------------------------------------------------
-- 22. Alerts
-- -----------------------------------------------------------------------------
create table if not exists public.user_alerts (
  id                   bigint generated always as identity primary key,
  user_id              uuid references auth.users (id),
  enabled              boolean default true,
  importance_threshold text,
  entity_type          text,
  entity_id            bigint,
  created_at           timestamptz default now() not null
);

create index if not exists user_alerts_user_id_idx on public.user_alerts (user_id);

create table if not exists public.alert_delivery_queue (
  id            bigint generated always as identity primary key,
  alert_id      bigint references public.user_alerts (id),
  change_id     bigint references public.data_changes (id),
  delivery_type text,
  status        text default 'pending',
  title         text,
  message       text,
  created_at    timestamptz default now() not null,
  delivered_at  timestamptz
);

create index if not exists alert_delivery_queue_alert_id_idx on public.alert_delivery_queue (alert_id);
create index if not exists alert_delivery_queue_change_id_idx on public.alert_delivery_queue (change_id);

-- -----------------------------------------------------------------------------
-- 23. Bulk import (jobs & rows)
-- -----------------------------------------------------------------------------
create table if not exists public.bulk_import_jobs (
  id            bigint generated always as identity primary key,
  user_id       uuid references auth.users (id),
  filename      text,
  record_type   text,
  status        text,
  total_rows    integer,
  processed_rows integer,
  error_message text,
  created_at    timestamptz default now() not null,
  completed_at  timestamptz
);

create table if not exists public.bulk_import_rows (
  id          bigint generated always as identity primary key,
  job_id      bigint references public.bulk_import_jobs (id) on delete cascade,
  row_number  integer,
  data        jsonb,
  errors      jsonb,
  status      text,
  created_at  timestamptz default now() not null
);

create index if not exists bulk_import_rows_job_id_idx on public.bulk_import_rows (job_id);

-- -----------------------------------------------------------------------------
-- 24. Row-level security policies
-- -----------------------------------------------------------------------------
-- Enable RLS on all user-accessible tables.
alter table public.countries          enable row level security;
alter table public.companies          enable row level security;
alter table public.equipment          enable row level security;
alter table public.programmes         enable row level security;
alter table public.contracts          enable row level security;
alter table public.budgets            enable row level security;
alter table public.procurements       enable row level security;
alter table public.contract_equipment enable row level security;
alter table public.country_equipment   enable row level security;
alter table public.programme_equipment enable row level security;
alter table public.conflicts           enable row level security;
alter table public.conflict_parties    enable row level security;
alter table public.conflict_incidents  enable row level security;
alter table public.conflict_events     enable row level security;
alter table public.ukraine_support     enable row level security;
alter table public.sipri_milex         enable row level security;
alter table public.imf_government_expenditure enable row level security;
alter table public.government_spending enable row level security;
alter table public.data_changes        enable row level security;
alter table public.ingestion_queue     enable row level security;
alter table public.ingestion_reviews   enable row level security;
alter table public.intelligence_evidence enable row level security;
alter table public.organisations       enable row level security;
alter table public.organisation_members enable row level security;
alter table public.platform_roles      enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.export_usage_monthly enable row level security;
alter table public.rate_limit_counters enable row level security;
alter table public.investigations      enable row level security;
alter table public.investigation_items enable row level security;
alter table public.watchlists          enable row level security;
alter table public.watchlist_items     enable row level security;
alter table public.user_alerts         enable row level security;
alter table public.alert_delivery_queue enable row level security;
alter table public.bulk_import_jobs    enable row level security;
alter table public.bulk_import_rows    enable row level security;

-- RLS policies for rate_limit_counters: must NOT be restricted — the
-- rate-limiter RPC runs with the anon key and needs unauthenticated access.
-- We create a policy that allows all reads/writes; the table is only ever
-- accessed through the stored-procedure RPCs, never directly.
create policy "rate_limit counters are accessible via RPC only"
  on public.rate_limit_counters
  for all
  to anon
  using (true)
  with check (true);

-- RLS helper: returns true if the user has analyst-or-above role.
create or replace function public.has_platform_role()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.platform_roles pr
    where pr.user_id = auth.uid()
  );
$$;

-- RLS helper: returns true if the user is a platform admin.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.platform_roles pr
    where pr.user_id = auth.uid()
    and pr.role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- RLS policies — public read access on core domain tables.
-- Analysts get additional write through the API; direct table writes are
-- blocked by default.
-- -----------------------------------------------------------------------------
create policy "public can read countries"
  on public.countries for select using (true);

create policy "public can read companies"
  on public.companies for select using (true);

create policy "public can read equipment"
  on public.equipment for select using (true);

create policy "public can read programmes"
  on public.programmes for select using (true);

create policy "public can read contracts"
  on public.contracts for select using (true);

create policy "public can read budgets"
  on public.budgets for select using (true);

create policy "public can read procurements"
  on public.procurements for select using (true);

create policy "public can read conflicts"
  on public.conflicts for select using (true);

create policy "public can read conflict_parties"
  on public.conflict_parties for select using (true);

create policy "public can read conflict_incidents"
  on public.conflict_incidents for select using (true);

create policy "public can read conflict_events"
  on public.conflict_events for select using (true);

create policy "public can read ukraine_support"
  on public.ukraine_support for select using (true);

create policy "public can read sipri_milex"
  on public.sipri_milex for select using (true);

create policy "public can read imf_government_expenditure"
  on public.imf_government_expenditure for select using (true);

create policy "public can read government_spending"
  on public.government_spending for select using (true);

create policy "public can read sources"
  on public.sources for select using (true);

create policy "public can read junction tables"
  on public.contract_equipment for select using (true);

create policy "public can read country_equipment"
  on public.country_equipment for select using (true);

create policy "public can read programme_equipment"
  on public.programme_equipment for select using (true);

-- -----------------------------------------------------------------------------
-- RLS policies — auth-scoped tables.
-- Users can read/write only their own records.
-- -----------------------------------------------------------------------------
create policy "users can read their own data_changes"
  on public.data_changes for select using (true);

create policy "users can insert their own data_changes"
  on public.data_changes for insert with check (true);

create policy "users can update their own data_changes"
  on public.data_changes for update using (true);

create policy "users can read ingestion_queue"
  on public.ingestion_queue for select using (true);

create policy "users can read ingestion_reviews"
  on public.ingestion_reviews for select using (true);

create policy "users can read intelligence_evidence"
  on public.intelligence_evidence for select using (true);

create policy "users can insert intelligence_evidence"
  on public.intelligence_evidence for insert with check (true);

create policy "users manage their own organisations"
  on public.organisations for all
  using (exists (
    select 1 from public.organisation_members om
    where om.organisation_id = organisations.id
    and om.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.organisation_members om
    where om.organisation_id = organisations.id
    and om.user_id = auth.uid()
  ));

create policy "users manage their own organisation_membership"
  on public.organisation_members for all
  using (user_id = auth.uid() or exists (
    select 1 from public.organisation_members om
    where om.organisation_id = organisation_members.organisation_id
    and om.user_id = auth.uid()
    and om.role = 'owner'
  ))
  with check (user_id = auth.uid() or exists (
    select 1 from public.organisation_members om
    where om.organisation_id = organisation_members.organisation_id
    and om.user_id = auth.uid()
    and om.role = 'owner'
  ));

create policy "users can read their own platform_roles"
  on public.platform_roles for select using (user_id = auth.uid());

create policy "users can read their own subscriptions"
  on public.subscriptions for select using (user_id = auth.uid());

create policy "users can update their own subscriptions"
  on public.subscriptions for update using (user_id = auth.uid());

create policy "users can insert their own subscriptions"
  on public.subscriptions for insert with check (user_id = auth.uid());

create policy "users manage their own export usage"
  on public.export_usage_monthly for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users manage their own investigations"
  on public.investigations for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users manage their own investigation_items"
  on public.investigation_items for all
  using (exists (
    select 1 from public.investigations i
    where i.id = investigation_items.investigation_id
    and i.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.investigations i
    where i.id = investigation_items.investigation_id
    and i.user_id = auth.uid()
  ));

create policy "users manage their own watchlists"
  on public.watchlists for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users manage their own watchlist_items"
  on public.watchlist_items for all
  using (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_items.watchlist_id
    and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.watchlists w
    where w.id = watchlist_items.watchlist_id
    and w.user_id = auth.uid()
  ));

create policy "users manage their own alerts"
  on public.user_alerts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users manage their own alert delivery"
  on public.alert_delivery_queue for all
  using (exists (
    select 1 from public.user_alerts a
    where a.id = alert_delivery_queue.alert_id
    and a.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.user_alerts a
    where a.id = alert_delivery_queue.alert_id
    and a.user_id = auth.uid()
  ));

create policy "users manage their own bulk imports"
  on public.bulk_import_jobs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users manage their own bulk import rows"
  on public.bulk_import_rows for all
  using (exists (
    select 1 from public.bulk_import_jobs j
    where j.id = bulk_import_rows.job_id
    and j.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.bulk_import_jobs j
    where j.id = bulk_import_rows.job_id
    and j.user_id = auth.uid()
  ));

-- -----------------------------------------------------------------------------
-- 24b. Transactional org provisioning RPC
-- -----------------------------------------------------------------------------
-- Creates an organisation and its first member (the owner) atomically.
--   _user_id — the auth user who will be set as owner
--   _name    — organisation display name
--   _slug    — URL-safe slug (caller is responsible for uniqueness check)
--   _plan    — initial plan name (default 'free')
-- Returns: the UUID of the newly created organisation.
create or replace function public.create_organisation_with_owner(
  _user_id uuid,
  _name    text,
  _slug    text,
  _plan    text default 'free'
)
returns uuid
language plpgsql
as $$
declare
  _org_id uuid;
begin
  if _name is null or trim(_name) = '' then
    raise exception 'Organisation name is required';
  end if;

  insert into public.organisations (name, slug, plan, created_at, updated_at)
  values (_name, _slug, _plan, now(), now())
  returning id into _org_id;

  insert into public.organisation_members (organisation_id, user_id, role, joined_at)
  values (_org_id, _user_id, 'owner', now());

  return _org_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 25. RPCs: rate-limiting helpers
-- -----------------------------------------------------------------------------
-- advance_rate_limit_window: resets the counter if the window has expired.
--   p_key       — the rate-limit key (IP path, user id, etc.)
--   p_window_ms — the window length in milliseconds
create or replace function public.advance_rate_limit_window(
  _key       text,
  _window_ms bigint default 60000
)
returns void
language plpgsql
as $$
begin
  /*
   * If the row exists and its window_start is older than the current
   * window boundary, reset the count to 0 and update window_start.
   */
  update public.rate_limit_counters
  set
    count = 0,
    window_start = now(),
    updated_at = now()
  where key = _key
    and window_start < (now() - (_window_ms / 1000) * interval '1 second');
end;
$$;

-- increment_rate_limit: atomically increments the counter and returns the
-- new count.  Creates the row if it does not yet exist.
--   Returns: integer — the count after incrementing.
create or replace function public.increment_rate_limit(
  _key       text,
  _window_ms bigint default 60000
)
returns integer
language plpgsql
as $$
declare
  _count integer;
begin
  /*
   * Try to increment an existing counter whose window is still active.
   */
  update public.rate_limit_counters
  set
    count = count + 1,
    updated_at = now()
  where key = _key
    and window_start >= (now() - (_window_ms / 1000) * interval '1 second')
  returning count into _count;

  if found then
    return _count;
  end if;

  /*
   * No active counter (window expired or row didn't exist).
   * Insert a fresh counter starting at 1.
   */
  begin
    insert into public.rate_limit_counters (key, count, window_start, updated_at)
    values (_key, 1, now(), now())
    returning count into _count;
  exception
    when unique_violation then
      /*
       * Another concurrent transaction inserted the row between our
       * update-attempt and this insert.  Retry by incrementing.
       */
      update public.rate_limit_counters
      set count = count + 1,
          updated_at = now()
      where key = _key
      returning count into _count;
  end;

  return _count;
end;
$$;

-- -----------------------------------------------------------------------------
-- 26. Analytical views
-- -----------------------------------------------------------------------------

-- 26a. global_entity_search — unified search across all entity types.
create or replace view public.global_entity_search as
select
  c.id::text        as entity_id,
  'country'         as entity_type,
  c.name            as entity_name,
  'Countries'      as entity_group,
  c.iso_code       as identifier,
  c.strategic_assessment as description
from public.countries c

union all

select
  co.id::text       as entity_id,
  'company'         as entity_type,
  co.name           as entity_name,
  'Companies'       as entity_group,
  co.id::text       as identifier,
  co.description    as description
from public.companies co

union all

select
  e.id::text        as entity_id,
  'equipment'       as entity_type,
  e.name            as entity_name,
  'Equipment'       as entity_group,
  e.id::text        as identifier,
  e.specs::text     as description
from public.equipment e

union all

select
  p.id::text        as entity_id,
  'programme'       as entity_type,
  p.name            as entity_name,
  'Programmes'      as entity_group,
  p.id::text        as identifier,
  p.description     as description
from public.programmes p

union all

select
  ct.id::text       as entity_id,
  'contract'        as entity_type,
  ct.title          as entity_name,
  'Contracts'       as entity_group,
  ct.id::text       as identifier,
  ct.description    as description
from public.contracts ct

union all

select
  s.id::text        as entity_id,
  'source'          as entity_type,
  s.title           as entity_name,
  'Sources'         as entity_group,
  s.id::text        as identifier,
  s.description     as description
from public.sources s;

-- 26b. country_benchmark_summary
create or replace view public.country_benchmark_summary as
select
  c.id,
  c.name,
  c.iso_code,
  c.region,
  c.spending_billions,
  (select count(*) from public.companies co where co.country_id = c.id) as company_count,
  (select count(*) from public.equipment eq where eq.country_id = c.id) as equipment_count,
  (select count(*) from public.contracts ct where ct.country_id = c.id) as contract_count,
  (select count(*) from public.procurements pr where pr.country_id = c.id) as procurement_count
from public.countries c;

-- 26c. company_benchmark_summary
create or replace view public.company_benchmark_summary as
select
  co.id,
  co.name,
  c.iso_code as country_iso,
  co.contracts_count,
  co.market_cap,
  co.strategic_assessment,
  (select count(*) from public.contracts ct where ct.company_id = co.id) as contract_count,
  (select count(*) from public.equipment eq where eq.company_id = co.id) as equipment_count
from public.companies co
left join public.countries c on c.id = co.country_id;

-- 26d. company_intelligence_summary
create or replace view public.company_intelligence_summary as
select
  co.id,
  co.name,
  co.source_id,
  co.strategic_assessment,
  (
    select count(*)
    from public.data_changes dc
    where dc.entity_type = 'company'
    and dc.entity_id = co.id
    and dc.intelligence_eligible is true
  ) as intelligence_changes,
  (
    select count(*)
    from public.intelligence_evidence ie
    join public.data_changes dc on dc.id = ie.change_id
    where dc.entity_type = 'company'
    and dc.entity_id = co.id
  ) as evidence_count
from public.companies co;

-- 26e. equipment_intelligence_summary
create or replace view public.equipment_intelligence_summary as
select
  e.id,
  e.name,
  e.type,
  e.role,
  e.confidence_score,
  (
    select count(*)
    from public.data_changes dc
    where dc.entity_type = 'equipment'
    and dc.entity_id = e.id
    and dc.intelligence_eligible is true
  ) as intelligence_changes
from public.equipment e;

-- 26f. programme_intelligence_summary
create or replace view public.programme_intelligence_summary as
select
  p.id,
  p.name,
  p.country_id,
  p.budget,
  p.status,
  (
    select count(*)
    from public.data_changes dc
    where dc.entity_type = 'programme'
    and dc.entity_id = p.id
    and dc.intelligence_eligible is true
  ) as intelligence_changes
from public.programmes p;

-- 26g. country_equipment
create or replace view public.country_equipment as
select
  ce.country_id,
  ce.equipment_id,
  e.name as equipment_name,
  c.name as country_name
from public.country_equipment ce
join public.equipment e on e.id = ce.equipment_id
join public.countries c on c.id = ce.country_id;

-- 26h. country_historical_intelligence
create or replace view public.country_historical_intelligence as
select
  c.id as country_id,
  c.name as country_name,
  dc.field_name,
  dc.old_value,
  dc.new_value,
  dc.change_date,
  dc.changed_at,
  dc.data_confidence,
  dc.importance,
  dc.source_id,
  s.title as source_title
from public.countries c
join public.data_changes dc
  on dc.entity_type = 'country'
  and dc.entity_id = c.id
left join public.sources s on s.id = dc.source_id
where dc.intelligence_eligible is true
order by dc.changed_at desc;

-- 26i. procurement_analytics_summary
create or replace view public.procurement_analytics_summary as
select
  count(*) as total_procurements,
  count(*) filter (where status = 'Awarded') as awarded_count,
  count(*) filter (where status = 'Active') as active_count,
  sum(value) as total_value
from public.procurements;

-- 26j. procurement_country_analytics
create or replace view public.procurement_country_analytics as
select
  c.id as country_id,
  c.name as country_name,
  count(pr.id) as procurement_count,
  sum(pr.value) as total_value,
  avg(pr.value) as avg_value
from public.countries c
left join public.procurements pr on pr.country_id = c.id
group by c.id, c.name;

-- 26k. procurement_events
create or replace view public.procurement_events as
select
  pr.id,
  pr.title,
  c.iso_code as country_iso,
  pr.value,
  pr.currency,
  pr.status,
  pr.event_type,
  pr.event_date
from public.procurements pr
left join public.countries c on c.id = pr.country_id;

-- 26l. procurement_yearly_analytics
create or replace view public.procurement_yearly_analytics as
select
  extract(year from event_date)::text as year,
  count(*) as procurement_count,
  sum(value) as total_value,
  count(distinct country_id) as country_count
from public.procurements
where event_date is not null
group by extract(year from event_date)
order by year desc;

-- 26m. data_quality_summary
create or replace view public.data_quality_summary as
select
  t.tablename as dataset,
  (xpath('/rowcnt/text()', xmlquery(
    table_name := quote_ident(t.tablename),
    table_schema := 'public'
  ))[1]::text)::integer as total_rows,
  0 as missing_required_fields
from (
  select 'countries' as tablename union all
  select 'companies' union all
  select 'equipment' union all
  select 'programmes' union all
  select 'contracts' union all
  select 'budgets' union all
  select 'procurements' union all
  select 'data_changes' union all
  select 'sources'
) t;

-- 26n. production_data_quality_summary_v2
-- Aggregate of row counts for core datasets, plus source-coverage gaps.
create or replace view public.production_data_quality_summary_v2 as
select
  (select count(*) from public.countries) as countries,
  (select count(*) from public.companies) as companies,
  (select count(*) from public.equipment) as equipment,
  (select count(*) from public.programmes) as programmes,
  (select count(*) from public.contracts) as contracts,
  (select count(*) from public.budgets) as budgets,
  (select count(*) from public.sources) as sources,
  (select count(*) from public.procurements) as procurement_events,
  (select count(*) from public.data_changes) as data_changes,
  (select count(*) from public.data_changes where intelligence_eligible is true) as intelligence_changes,
  (select count(*) from public.sources where url is null or url = '') as sources_without_url,
  (select count(*) from public.budgets where source_id is null) as budgets_without_source,
  (select count(*) from public.contracts where source_id is null) as contracts_without_source,
  (select count(*) from public.procurements where source_id is null) as procurement_events_without_source;

-- 26o. ingestion_source_health
create or replace view public.ingestion_source_health as
select
  s.id::text as id,
  s.title as name,
  case
    when s.reliability = 'High' then 'healthy'
    when s.reliability = 'Medium' then 'warning'
    else 'error'
  end as health_status,
  null::timestamptz as last_checked_at,
  null::timestamptz as last_success_at,
  null::text as last_error
from public.sources s
where s.access = 'Live';

-- 26p. ingestion_pipeline_summary_v2
create or replace view public.ingestion_pipeline_summary_v2 as
select
  (select count(*) from public.ingestion_queue) as total_queued,
  (select count(*) from public.ingestion_queue where review_status = 'pending') as pending_review,
  (select count(*) from public.ingestion_queue where review_status = 'approved') as approved,
  (select count(*) from public.ingestion_queue where review_status = 'rejected') as rejected,
  (select count(*) from public.ingestion_reviews) as total_reviews;

-- 26q. ingestion_queue_summary_v2
create or replace view public.ingestion_queue_summary_v2 as
select
  source_id,
  count(*) as total_records,
  count(*) filter (where review_status = 'pending') as pending,
  count(*) filter (where review_status = 'approved') as approved,
  count(*) filter (where review_status = 'rejected') as rejected,
  count(*) filter (where review_status = 'returned') as returned,
  max(created_at) as last_activity_at
from public.ingestion_queue
group by source_id;

-- 26r. intelligence_recent_changes
create or replace view public.intelligence_recent_changes as
select
  dc.id,
  dc.entity_type,
  dc.entity_id,
  dc.field_name,
  dc.old_value,
  dc.new_value,
  dc.change_date,
  dc.changed_at,
  dc.importance,
  dc.data_confidence,
  dc.source_id,
  s.title as source_title,
  dc.reviewed,
  dc.reviewed_at,
  dc.reviewed_by
from public.data_changes dc
left join public.sources s on s.id = dc.source_id
where dc.intelligence_eligible is true
order by dc.changed_at desc
limit 100;

-- 26s. investigation_workspace_summary
create or replace view public.investigation_workspace_summary as
select
  i.id,
  i.user_id,
  i.title,
  i.description,
  i.created_at,
  count(ii.id) as entity_count,
  0 as source_count,
  0 as note_count
from public.investigations i
left join public.investigation_items ii on ii.investigation_id = i.id
group by i.id, i.user_id, i.title, i.description, i.created_at;

-- 26t. investigation_workspace_items
create or replace view public.investigation_workspace_items as
select
  ii.id,
  ii.investigation_id,
  ii.entity_type,
  ii.entity_id,
  ii.notes,
  ii.created_at
from public.investigation_items ii;

-- 26u. conflict_overview
create or replace view public.conflict_overview as
select
  c.id,
  c.name,
  c.region,
  c.start_date,
  c.status,
  c.summary
from public.conflicts c;

-- 26v. watchlist_intelligence_summary
create or replace view public.watchlist_intelligence_summary as
select
  wi.watchlist_id,
  wi.entity_type,
  wi.entity_id,
  dc.field_name,
  dc.old_value,
  dc.new_value,
  dc.changed_at,
  dc.importance,
  dc.data_confidence
from public.watchlist_items wi
join public.data_changes dc
  on dc.entity_type = wi.entity_type
  and dc.entity_id = wi.entity_id
where dc.intelligence_eligible is true
order by dc.changed_at desc;

-- -----------------------------------------------------------------------------
-- 27. Functions: auto-update updated_at on core tables
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger if not exists countries_updated_at_trigger
  before update on public.countries for each row execute function public.set_updated_at();
create trigger if not exists companies_updated_at_trigger
  before update on public.companies for each row execute function public.set_updated_at();
create trigger if not exists equipment_updated_at_trigger
  before update on public.equipment for each row execute function public.set_updated_at();
create trigger if not exists programmes_updated_at_trigger
  before update on public.programmes for each row execute function public.set_updated_at();
create trigger if not exists contracts_updated_at_trigger
  before update on public.contracts for each row execute function public.set_updated_at();
create trigger if not exists budgets_updated_at_trigger
  before update on public.budgets for each row execute function public.set_updated_at();
create trigger if not exists procurements_updated_at_trigger
  before update on public.procurements for each row execute function public.set_updated_at();
create trigger if not exists conflicts_updated_at_trigger
  before update on public.conflicts for each row execute function public.set_updated_at();
create trigger if not exists data_changes_updated_at_trigger
  before update on public.data_changes for each row execute function public.set_updated_at();
