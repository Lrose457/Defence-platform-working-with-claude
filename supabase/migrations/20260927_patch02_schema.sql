-- =============================================================================
-- Patch 0.2 — schema additions
-- Conflict intensity, legislation pipeline, revolving door, non-state actors,
-- effectiveness inputs, country sections, force structure, markets, survey.
--
-- Conventions follow the existing migrations (RLS on, views security_invoker).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Conflict intensity (HIIK-methodology levels 1–5, applied platform-side)
-- ---------------------------------------------------------------------------
alter table public.conflicts
  add column if not exists intensity_level smallint
    check (intensity_level between 1 and 5);
alter table public.conflict_incidents
  add column if not exists intensity_level smallint
    check (intensity_level between 1 and 5);

-- ---------------------------------------------------------------------------
-- 2. Legislation pipeline (replaces static demo data on /legislation)
-- ---------------------------------------------------------------------------
create table if not exists public.legislation_pipeline (
  id            bigint generated always as identity primary key,
  title         text not null,
  kind          text not null default 'bill'
                check (kind in ('bill','defence_review','budget_authorisation','policy')),
  country_id    bigint references public.countries(id) on delete set null,
  body          text,
  stage         text check (stage in
                ('proposed','introduced','under_review','passed','funded','enacted','withdrawn')),
  description   text,
  source_id     bigint references public.sources(id) on delete set null,
  source_url    text,
  expected_date date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists legislation_pipeline_country_idx
  on public.legislation_pipeline (country_id);

-- ---------------------------------------------------------------------------
-- 3. Revolving door (patch 0.2 doc: politicians ↔ defence industry)
-- ---------------------------------------------------------------------------
create table if not exists public.people (
  id          bigint generated always as identity primary key,
  full_name   text not null,
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.role_tenures (
  id              bigint generated always as identity primary key,
  person_id       bigint not null references public.people(id) on delete cascade,
  role_title      text not null,
  organisation    text not null,
  sector          text not null check (sector in ('government','industry','military','other')),
  country_id      bigint references public.countries(id) on delete set null,
  company_id      bigint references public.companies(id) on delete set null,
  started_on      date,
  ended_on        date,
  source_id       bigint references public.sources(id) on delete set null,
  source_url      text,
  evidence_level  text not null default 'unverified',
  created_at      timestamptz not null default now(),
  constraint role_tenures_dates_check check (
    ended_on is null or started_on is null or ended_on >= started_on
  )
);

create index if not exists role_tenures_person_idx   on public.role_tenures (person_id);
create index if not exists role_tenures_company_idx  on public.role_tenures (company_id);

-- A "move" pairs a government/military tenure with a later industry tenure.
create or replace view public.revolving_door_overview as
select
  industry_tenure.id,
  person.id                                    as person_id,
  person.full_name                             as person_name,
  govt_tenure.role_title                       as former_role,
  govt_tenure.organisation                     as former_organisation,
  industry_tenure.role_title                   as industry_role,
  industry_tenure.company_id                   as company_id,
  industry_tenure.started_on                   as started_on,
  industry_tenure.ended_on                     as ended_on,
  src.name                                     as source_name,
  industry_tenure.source_url                   as source_url,
  industry_tenure.evidence_level               as evidence_level
from public.role_tenures industry_tenure
join public.people person            on person.id = industry_tenure.person_id
join public.role_tenures govt_tenure on govt_tenure.person_id = person.id
                                    and govt_tenure.sector in ('government','military')
                                    and (govt_tenure.ended_on is null
                                         or industry_tenure.started_on is null
                                         or govt_tenure.ended_on <= industry_tenure.started_on)
left join public.sources src          on src.id = industry_tenure.source_id
where industry_tenure.sector = 'industry';

-- ---------------------------------------------------------------------------
-- 4. Effectiveness inputs (doc criteria: on time, on budget)
-- ---------------------------------------------------------------------------
alter table public.contracts
  add column if not exists planned_end_date   date,
  add column if not exists actual_end_date    date,
  add column if not exists planned_value_usd  numeric,
  add column if not exists actual_value_usd   numeric;

-- ---------------------------------------------------------------------------
-- 5. Non-state actors (PMCs, paramilitaries, terrorist orgs, funding)
-- ---------------------------------------------------------------------------
create table if not exists public.nonstate_actors (
  id            bigint generated always as identity primary key,
  name          text not null,
  actor_type    text not null check (actor_type in
                ('pmc','paramilitary','terrorist','insurgent','other')),
  region        text,
  status        text,
  summary       text,
  -- Descriptive funding links only; never operational detail.
  funder_notes  text,
  source_id     bigint references public.sources(id) on delete set null,
  source_url    text,
  evidence_level text not null default 'unverified',
  created_at    timestamptz not null default now()
);

create or replace view public.nonstate_actor_overview as
select
  a.id, a.name, a.actor_type, a.region, a.status, a.summary,
  case
    when a.funder_notes is null or a.funder_notes = '' then null
    else string_to_array(a.funder_notes, ';')
  end                                            as funder_names,
  s.name                                         as source_name,
  a.source_url,
  a.evidence_level
from public.nonstate_actors a
left join public.sources s on s.id = a.source_id;

-- ---------------------------------------------------------------------------
-- 6. Country-page views (programmes, conflicts, markets, force structure,
--    domestic contractors)
-- ---------------------------------------------------------------------------

-- Joint programmes per country (e.g. GCAP, AUKUS).
create or replace view public.country_programme_overview as
select
  c.id    as country_id,
  p.id    as id,
  p.name  as name,
  p.status as status,
  array_agg(distinct other.name)                     as partner_countries,
  array_agg(distinct other.id)                       as country_ids
from public.programmes p
join public.country_programmes cp      on cp.programme_id = p.id
join public.countries c                on c.id = cp.country_id
left join public.country_programmes cp2 on cp2.programme_id = p.id and cp2.country_id <> c.id
left join public.countries other        on other.id = cp2.country_id
group by c.id, p.id, p.name, p.status;

-- Conflicts a country is directly involved in.
create or replace view public.country_conflict_overview as
select
  cp.country_id,
  c.id      as conflict_id,
  c.name,
  c.status,
  c.intensity_level,
  c.region
from public.conflict_parties cp
join public.conflicts c on c.id = cp.conflict_id;

-- Supplier-bloc alignment ("markets" section).
create table if not exists public.country_market_alignment (
  country_id    bigint not null references public.countries(id) on delete cascade,
  bloc          text not null,
  relationship  text check (relationship in
                ('primary_supplier','major_customer','partner','aligns_with')),
  share_percent numeric check (share_percent between 0 and 100),
  source_id     bigint references public.sources(id) on delete set null,
  primary key (country_id, bloc)
);

create or replace view public.country_market_overview as
select country_id, bloc, relationship, share_percent
from public.country_market_alignment;

-- Force structure / army sizes with equipment cross-reference.
create table if not exists public.country_force_structure (
  id            bigint generated always as identity primary key,
  country_id    bigint not null references public.countries(id) on delete cascade,
  branch        text check (branch in ('army','navy','air_force','joint','space')),
  unit_type     text not null,          -- division, brigade, flotilla, wing…
  units         integer,
  personnel     integer,
  equipment_id  bigint references public.equipment(id) on delete set null,
  required_qty  integer,                -- doctrine establishment for this formation
  source_id     bigint references public.sources(id) on delete set null,
  created_at    timestamptz not null default now()
);

create or replace view public.country_force_structure_overview as
select
  f.id, f.country_id, f.branch, f.unit_type, f.units, f.personnel,
  f.equipment_id,
  e.name                                  as equipment_name,
  coalesce(held.total, 0)                 as held_qty,
  f.required_qty
from public.country_force_structure f
left join public.equipment e on e.id = f.equipment_id
left join (
  select country_id, equipment_id, sum(coalesce(quantity, operational_qty, 0)) as total
  from public.country_equipment
  group by country_id, equipment_id
) held on held.country_id = f.country_id and held.equipment_id = f.equipment_id;

-- Domestic contractors per country.
create or replace view public.country_domestic_contractors_overview as
select
  c.id,
  c.headquarters_country       as country_id,
  c.id                         as company_id,
  c.name,
  c.sector,
  c.company_type,
  count(k.id)                  as contract_count
from public.companies c
left join public.contracts k on k.company_id = c.id
group by c.id, c.headquarters_country, c.name, c.sector, c.company_type;

-- ---------------------------------------------------------------------------
-- 7. Anonymous user survey (consent-gated, no PII)
-- ---------------------------------------------------------------------------
create table if not exists public.user_survey_responses (
  id                       bigint generated always as identity primary key,
  role                     text not null,
  organisation_type        text,
  benefit                  text not null,
  comments                 text,
  anonymous_session_hash   text,
  created_at               timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. Search-log daily aggregate for /admin/analytics
-- ---------------------------------------------------------------------------
create or replace function public.search_log_daily_agg(p_days integer default 30)
returns table (day date, searches bigint, distinct_sessions bigint)
language sql
security definer
set search_path = public
as $$
  select
    (searched_at at time zone 'utc')::date as day,
    count(*)                               as searches,
    count(distinct session_hash)           as distinct_sessions
  from public.anonymous_search_log
  where searched_at >= now() - make_interval(days => greatest(p_days, 1))
  group by 1
  order by 1 desc
  limit 90;
$$;

-- ---------------------------------------------------------------------------
-- 9. RLS: public reads, service writes (mirrors existing table patterns)
-- ---------------------------------------------------------------------------
alter table public.legislation_pipeline       enable row level security;
alter table public.people                     enable row level security;
alter table public.role_tenures               enable row level security;
alter table public.nonstate_actors            enable row level security;
alter table public.country_market_alignment   enable row level security;
alter table public.country_force_structure    enable row level security;
alter table public.user_survey_responses      enable row level security;

create policy "public can read legislation"      on public.legislation_pipeline      for select using (true);
create policy "public can read people"           on public.people                    for select using (true);
create policy "public can read role tenures"     on public.role_tenures              for select using (true);
create policy "public can read nonstate actors"  on public.nonstate_actors           for select using (true);
create policy "public can read market alignment" on public.country_market_alignment  for select using (true);
create policy "public can read force structure"  on public.country_force_structure   for select using (true);

-- Survey: insert-only for anon via API (server uses anon key + RLS).
create policy "anon can submit surveys" on public.user_survey_responses
  for insert to anon, authenticated with check (true);
-- No select policy: responses are readable only by the service role / admin dashboards
-- through the server-side client.
