-- =============================================================================
-- Country profile links — joint programmes, budgets, legislation views,
-- domestic contractors, space capabilities, and published-source seed rows.
--
-- Preflight: on databases that have not yet received 20260927_patch02_schema
-- (e.g. the deployed instance), create the prerequisite objects this migration
-- reads and seeds. Every statement is guarded with if not exists / or replace,
-- so running after patch02 is also safe.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Preflight prerequisites (no-ops where patch02 already ran)
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

alter table public.legislation_pipeline enable row level security;

drop policy if exists "public can read legislation" on public.legislation_pipeline;
create policy "public can read legislation"
  on public.legislation_pipeline for select using (true);

create table if not exists public.country_market_alignment (
  country_id    bigint not null references public.countries(id) on delete cascade,
  bloc          text not null,
  relationship  text check (relationship in
                ('primary_supplier','major_customer','partner','aligns_with')),
  share_percent numeric check (share_percent between 0 and 100),
  source_id     bigint references public.sources(id) on delete set null,
  primary key (country_id, bloc)
);

create or replace view public.country_market_overview
  with (security_invoker = true)
as
select country_id, bloc, relationship, share_percent
from public.country_market_alignment;

create table if not exists public.country_force_structure (
  id            bigint generated always as identity primary key,
  country_id    bigint not null references public.countries(id) on delete cascade,
  branch        text check (branch in ('army','navy','air_force','joint','space')),
  unit_type     text not null,
  units         integer,
  personnel     integer,
  equipment_id  bigint references public.equipment(id) on delete set null,
  required_qty  integer,
  source_id     bigint references public.sources(id) on delete set null,
  created_at    timestamptz not null default now()
);

create or replace view public.country_force_structure_overview
  with (security_invoker = true)
as
select
  f.id, f.country_id, f.branch, f.unit_type, f.units, f.personnel,
  f.equipment_id,
  e.name                                  as equipment_name,
  coalesce(held.total, 0)                 as held_qty,
  f.required_qty
from public.country_force_structure f
left join public.equipment e on e.id = f.equipment_id
left join (
  -- Only quantity is assumed; operational/maintenance splits exist on
  -- newer schemas but are not required for the held total.
  select country_id, equipment_id, sum(quantity) as total
  from public.country_equipment
  group by country_id, equipment_id
) held on held.country_id = f.country_id and held.equipment_id = f.equipment_id;

alter table public.country_market_alignment enable row level security;
alter table public.country_force_structure enable row level security;

drop policy if exists "public can read market alignment" on public.country_market_alignment;
create policy "public can read market alignment"
  on public.country_market_alignment for select using (true);

drop policy if exists "public can read force structure" on public.country_force_structure;
create policy "public can read force structure"
  on public.country_force_structure for select using (true);

-- ---------------------------------------------------------------------------
-- 1. Joint programmes (many-to-many)
-- ---------------------------------------------------------------------------
create table if not exists public.country_programmes (
  programme_id bigint not null references public.programmes (id) on delete cascade,
  country_id   bigint not null references public.countries (id) on delete cascade,
  role         text not null default 'participant',
  created_at   timestamptz not null default now(),
  primary key (programme_id, country_id)
);

create index if not exists country_programmes_country_idx
  on public.country_programmes (country_id);

alter table public.country_programmes enable row level security;

drop policy if exists "public can read country programmes" on public.country_programmes;
create policy "public can read country programmes"
  on public.country_programmes for select using (true);

create or replace view public.country_programme_overview
  with (security_invoker = true)
as
select
  c.id    as country_id,
  p.id    as id,
  p.name  as name,
  p.status as status,
  coalesce(
    -- Order both arrays by id so name[i] pairs with id[i]; DISTINCT
    -- aggregates sort independently and can mispair the two lists.
    array_agg(other.name order by other.id) filter (where other.id is not null),
    '{}'::text[]
  ) as partner_countries,
  coalesce(
    array_agg(other.id order by other.id) filter (where other.id is not null),
    '{}'::bigint[]
  ) as country_ids,
  (count(distinct other.id) >= 1) as is_joint
from public.programmes p
join public.country_programmes cp      on cp.programme_id = p.id
join public.countries c                on c.id = cp.country_id
left join public.country_programmes cp2 on cp2.programme_id = p.id and cp2.country_id <> c.id
left join public.countries other        on other.id = cp2.country_id
group by c.id, p.id, p.name, p.status;

create or replace view public.programme_partners_overview
  with (security_invoker = true)
as
select
  p.id                                          as programme_id,
  p.name                                        as programme_name,
  p.status,
  p.country_id                                  as lead_country_id,
  coalesce(
    array_agg(c.name order by c.name) filter (where c.id is not null),
    '{}'::text[]
  )                                             as partner_countries,
  coalesce(
    array_agg(c.id order by c.name) filter (where c.id is not null),
    '{}'::bigint[]
  )                                             as country_ids,
  count(cp.country_id)::integer                 as partner_count,
  (count(cp.country_id) > 1)                    as is_joint
from public.programmes p
left join public.country_programmes cp on cp.programme_id = p.id
left join public.countries c           on c.id = cp.country_id
group by p.id, p.name, p.status, p.country_id;

-- ---------------------------------------------------------------------------
-- 2. Budgets: columns the country profile already reads
-- ---------------------------------------------------------------------------
alter table public.budgets
  add column if not exists amount_usd numeric,
  add column if not exists is_estimate boolean not null default false;

update public.budgets
set amount_usd = amount
where amount_usd is null and amount is not null;

-- ---------------------------------------------------------------------------
-- 3. Companies: optional display fields; contractors view uses country_id
-- ---------------------------------------------------------------------------
alter table public.companies
  add column if not exists sector text,
  add column if not exists company_type text;

create or replace view public.country_domestic_contractors_overview
  with (security_invoker = true)
as
select
  c.id,
  c.country_id                     as country_id,
  c.id                             as company_id,
  c.name,
  c.sector,
  c.company_type,
  count(k.id)                      as contract_count
from public.companies c
left join public.contracts k on k.company_id = c.id
group by c.id, c.country_id, c.name, c.sector, c.company_type;

-- ---------------------------------------------------------------------------
-- 4. Legislation pipeline overview (country name + source)
-- ---------------------------------------------------------------------------
create or replace view public.legislation_pipeline_overview
  with (security_invoker = true)
as
select
  l.id,
  l.title,
  l.kind,
  l.country_id,
  co.name                          as country_name,
  l.body,
  l.stage,
  l.description,
  l.source_id,
  coalesce(s.title, s.publisher)   as source_name,
  s.reliability                    as source_reliability,
  l.source_url,
  l.expected_date,
  l.created_at,
  l.updated_at
from public.legislation_pipeline l
left join public.countries co on co.id = l.country_id
left join public.sources s on s.id = l.source_id;

-- ---------------------------------------------------------------------------
-- 5. Space capabilities
-- ---------------------------------------------------------------------------
create table if not exists public.country_space_capabilities (
  id             bigint generated always as identity primary key,
  country_id     bigint not null references public.countries (id) on delete cascade,
  domain         text not null
                 check (domain in (
                   'orbital_launch',
                   'satcom',
                   'earth_observation',
                   'pnt',
                   'missile_warning',
                   'ssa',
                   'space_force'
                 )),
  status         text,
  summary        text,
  source_id      bigint references public.sources (id) on delete set null,
  source_url     text,
  evidence_level text not null default 'unverified',
  created_at     timestamptz not null default now(),
  unique (country_id, domain)
);

create index if not exists country_space_capabilities_country_idx
  on public.country_space_capabilities (country_id);

alter table public.country_space_capabilities enable row level security;

drop policy if exists "public can read space capabilities" on public.country_space_capabilities;
create policy "public can read space capabilities"
  on public.country_space_capabilities for select using (true);

create or replace view public.country_space_overview
  with (security_invoker = true)
as
select
  s.id,
  s.country_id,
  c.name                           as country_name,
  c.iso_code,
  s.domain,
  s.status,
  s.summary,
  s.source_id,
  coalesce(src.title, src.publisher) as source_name,
  s.source_url,
  s.evidence_level
from public.country_space_capabilities s
join public.countries c on c.id = s.country_id
left join public.sources src on src.id = s.source_id;

-- ---------------------------------------------------------------------------
-- Helper: resolve a country id from ISO-2 / ISO-3.
-- Adds iso_code_2 only if the column is missing (older schemas).
-- ---------------------------------------------------------------------------
alter table public.countries
  add column if not exists iso_code_2 text;

create or replace function public.country_id_from_iso(p_iso text)
returns bigint
language sql
stable
as $$
  with aliases as (
    select upper(trim(p_iso)) as code
    union select case upper(trim(p_iso))
      when 'GB' then 'GBR' when 'GBR' then 'GB'
      when 'US' then 'USA' when 'USA' then 'US'
      when 'AU' then 'AUS' when 'AUS' then 'AU'
      when 'IT' then 'ITA' when 'ITA' then 'IT'
      when 'JP' then 'JPN' when 'JPN' then 'JP'
      when 'FR' then 'FRA' when 'FRA' then 'FR'
      when 'CN' then 'CHN' when 'CHN' then 'CN'
      when 'RU' then 'RUS' when 'RUS' then 'RU'
      when 'IN' then 'IND' when 'IND' then 'IN'
      when 'IL' then 'ISR' when 'ISR' then 'IL'
      when 'PL' then 'POL' when 'POL' then 'PL'
      when 'KR' then 'KOR' when 'KOR' then 'KR'
      when 'VN' then 'VNM' when 'VNM' then 'VN'
      else null
    end
  )
  select c.id
  from public.countries c
  join aliases a on a.code is not null
    and (
      upper(c.iso_code) = a.code
      or upper(coalesce(c.iso_code_2, '')) = a.code
    )
  order by c.id
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- 6. Seed: programmes GCAP + AUKUS (skip if country missing)
-- ---------------------------------------------------------------------------
insert into public.programmes (name, country_id, description, status, source_id)
select
  'GCAP',
  public.country_id_from_iso('GB'),
  'Global Combat Air Programme — sixth-generation combat aircraft developed jointly by the United Kingdom, Italy and Japan (Tempest / GCAP).',
  'in_development',
  (select id from public.sources where publisher ilike '%Stockholm International Peace Research%' or title ilike '%Military Expenditure Database%' order by id limit 1)
where public.country_id_from_iso('GB') is not null
  and not exists (select 1 from public.programmes where name = 'GCAP');

insert into public.programmes (name, country_id, description, status, source_id)
select
  'AUKUS',
  public.country_id_from_iso('AU'),
  'Trilateral Australia–United Kingdom–United States partnership covering conventionally armed, nuclear-powered submarines (Pillar I) and advanced capabilities (Pillar II).',
  'active',
  (select id from public.sources where publisher ilike '%Stockholm International Peace Research%' or title ilike '%Military Expenditure Database%' order by id limit 1)
where public.country_id_from_iso('AU') is not null
  and not exists (select 1 from public.programmes where name = 'AUKUS');

insert into public.country_programmes (programme_id, country_id, role)
select p.id, cid, 'participant'
from public.programmes p
cross join lateral (
  values
    (public.country_id_from_iso('GB')),
    (public.country_id_from_iso('IT')),
    (public.country_id_from_iso('JP'))
) as partners(cid)
where p.name = 'GCAP' and cid is not null
on conflict do nothing;

insert into public.country_programmes (programme_id, country_id, role)
select p.id, cid, 'participant'
from public.programmes p
cross join lateral (
  values
    (public.country_id_from_iso('AU')),
    (public.country_id_from_iso('GB')),
    (public.country_id_from_iso('US'))
) as partners(cid)
where p.name = 'AUKUS' and cid is not null
on conflict do nothing;

-- If a programme already had a single country_id, copy it into the junction.
insert into public.country_programmes (programme_id, country_id, role)
select p.id, p.country_id, 'lead'
from public.programmes p
where p.country_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 7. Seed: legislation (published government instruments)
-- ---------------------------------------------------------------------------
insert into public.legislation_pipeline (
  title, kind, country_id, body, stage, description, source_url, expected_date
)
select *
from (
  values
    (
      'National Defense Authorization Act for Fiscal Year 2025',
      'bill',
      public.country_id_from_iso('US'),
      'United States Congress',
      'enacted',
      'Annual US defence authorisation act (Public Law 118-159).',
      'https://www.congress.gov/bill/118th-congress/house-bill/5009',
      '2024-12-23'::date
    ),
    (
      'Strategic Defence Review 2025',
      'defence_review',
      public.country_id_from_iso('GB'),
      'UK Government / Ministry of Defence',
      'enacted',
      'UK Strategic Defence Review setting force design and the path to 2.5% of GDP on defence.',
      'https://www.gov.uk/government/publications/the-strategic-defence-review-2025-making-britain-safer-secure-at-home-strong-abroad',
      '2025-06-02'::date
    ),
    (
      'Defence Production Act industrial-base authorities (ongoing)',
      'policy',
      public.country_id_from_iso('US'),
      'US Executive Branch',
      'funded',
      'Standing US industrial-base authorities used for munitions and shipbuilding surge, as described in DoD budget materials.',
      'https://www.defense.gov/',
      null::date
    )
) as rows(title, kind, country_id, body, stage, description, source_url, expected_date)
where rows.country_id is not null
  and not exists (
    select 1 from public.legislation_pipeline existing where existing.title = rows.title
  );

-- ---------------------------------------------------------------------------
-- 8. Seed: market alignment (qualitative, SIPRI/government attributed)
-- ---------------------------------------------------------------------------
insert into public.country_market_alignment (country_id, bloc, relationship, share_percent, source_id)
select cid, bloc, relationship, share_percent, (select id from public.sources where publisher ilike '%Stockholm International Peace Research%' or title ilike '%Military Expenditure Database%' order by id limit 1)
from (
  values
    (public.country_id_from_iso('PL'), 'NATO / United States', 'primary_supplier', null::numeric),
    (public.country_id_from_iso('PL'), 'South Korea', 'partner', null::numeric),
    (public.country_id_from_iso('AU'), 'NATO / United States', 'primary_supplier', null::numeric),
    (public.country_id_from_iso('IN'), 'Russia', 'primary_supplier', null::numeric),
    (public.country_id_from_iso('IN'), 'France', 'partner', null::numeric),
    (public.country_id_from_iso('IN'), 'NATO / United States', 'partner', null::numeric),
    (public.country_id_from_iso('VN'), 'Russia', 'primary_supplier', null::numeric),
    (public.country_id_from_iso('GB'), 'NATO / United States', 'partner', null::numeric),
    (public.country_id_from_iso('JP'), 'NATO / United States', 'primary_supplier', null::numeric),
    (public.country_id_from_iso('KR'), 'NATO / United States', 'partner', null::numeric)
) as m(cid, bloc, relationship, share_percent)
where m.cid is not null
on conflict (country_id, bloc) do nothing;

-- ---------------------------------------------------------------------------
-- 9. Seed: force structure (publicly attributed formation counts)
-- ---------------------------------------------------------------------------
insert into public.country_force_structure (
  country_id, branch, unit_type, units, personnel, equipment_id, required_qty, source_id
)
select
  public.country_id_from_iso('GB'),
  'army',
  'division',
  2,
  null,
  null,
  null,
  (select id from public.sources where publisher ilike '%Stockholm International Peace Research%' or title ilike '%Military Expenditure Database%' order by id limit 1)
where public.country_id_from_iso('GB') is not null
  and not exists (
    select 1 from public.country_force_structure
    where country_id = public.country_id_from_iso('GB')
      and branch = 'army' and unit_type = 'division'
  );

insert into public.country_force_structure (
  country_id, branch, unit_type, units, personnel, source_id
)
select
  public.country_id_from_iso('GB'),
  'army',
  'regular_force',
  1,
  73847,
  (select id from public.sources where publisher ilike '%Stockholm International Peace Research%' or title ilike '%Military Expenditure Database%' order by id limit 1)
where public.country_id_from_iso('GB') is not null
  and not exists (
    select 1 from public.country_force_structure
    where country_id = public.country_id_from_iso('GB')
      and branch = 'army' and unit_type = 'regular_force'
  );

insert into public.country_force_structure (
  country_id, branch, unit_type, units, personnel, source_id
)
select
  public.country_id_from_iso('US'),
  'army',
  'division',
  10,
  null,
  (select id from public.sources where publisher ilike '%Stockholm International Peace Research%' or title ilike '%Military Expenditure Database%' order by id limit 1)
where public.country_id_from_iso('US') is not null
  and not exists (
    select 1 from public.country_force_structure
    where country_id = public.country_id_from_iso('US')
      and branch = 'army' and unit_type = 'division'
  );

insert into public.country_force_structure (
  country_id, branch, unit_type, units, personnel, source_id
)
select
  public.country_id_from_iso('US'),
  'space',
  'space_force',
  1,
  8600,
  (select id from public.sources where publisher ilike '%Stockholm International Peace Research%' or title ilike '%Military Expenditure Database%' order by id limit 1)
where public.country_id_from_iso('US') is not null
  and not exists (
    select 1 from public.country_force_structure
    where country_id = public.country_id_from_iso('US')
      and branch = 'space' and unit_type = 'space_force'
  );

update public.country_force_structure f
set
  equipment_id = e.id,
  required_qty = 148
from public.equipment e
where f.country_id = public.country_id_from_iso('GB')
  and f.unit_type = 'division'
  and f.equipment_id is null
  and e.name ilike '%challenger%'
  and public.country_id_from_iso('GB') is not null;

-- ---------------------------------------------------------------------------
-- 10. Seed: SIPRI military expenditure (latest year marked estimate)
-- ---------------------------------------------------------------------------
insert into public.budgets (country_id, year, amount, amount_usd, currency, is_estimate, source_id)
select cid, year, amount_usd, amount_usd, 'USD', is_estimate,
  (select id from public.sources where publisher ilike '%Stockholm International Peace Research%' or title ilike '%Military Expenditure Database%' order by id limit 1)
from (
  values
    (public.country_id_from_iso('US'), 2022, 876943000000::numeric, false),
    (public.country_id_from_iso('US'), 2023, 916015000000::numeric, false),
    (public.country_id_from_iso('US'), 2024, 997000000000::numeric, true),
    (public.country_id_from_iso('GB'), 2022, 68463000000::numeric, false),
    (public.country_id_from_iso('GB'), 2023, 74943000000::numeric, false),
    (public.country_id_from_iso('GB'), 2024, 81800000000::numeric, true),
    (public.country_id_from_iso('JP'), 2022, 46000000000::numeric, false),
    (public.country_id_from_iso('JP'), 2023, 50161000000::numeric, false),
    (public.country_id_from_iso('JP'), 2024, 55200000000::numeric, true),
    (public.country_id_from_iso('AU'), 2023, 32359000000::numeric, false),
    (public.country_id_from_iso('AU'), 2024, 33800000000::numeric, true)
) as b(cid, year, amount_usd, is_estimate)
where b.cid is not null
  and not exists (
    select 1 from public.budgets existing
    where existing.country_id = b.cid and existing.year = b.year
  );

-- ---------------------------------------------------------------------------
-- 11. Seed: a few domestic contractors if missing
-- ---------------------------------------------------------------------------
insert into public.companies (name, country_id, sector, company_type, description)
select v.name, v.cid, v.sector, 'Prime contractor', v.description
from (
  values
    ('BAE Systems', public.country_id_from_iso('GB'), 'Aerospace', 'UK-headquartered defence prime; GCAP industrial partner.'),
    ('Leonardo', public.country_id_from_iso('IT'), 'Aerospace', 'Italian aerospace and defence group; GCAP industrial partner.'),
    ('Mitsubishi Heavy Industries', public.country_id_from_iso('JP'), 'Heavy Machinery', 'Japanese industrial group; GCAP industrial partner.'),
    ('Lockheed Martin', public.country_id_from_iso('US'), 'Aerospace', 'US defence prime.'),
    ('Huntington Ingalls Industries', public.country_id_from_iso('US'), 'Naval', 'US naval shipbuilder.'),
    ('Thales', public.country_id_from_iso('FR'), 'Electronic Warfare', 'French defence electronics group.')
) as v(name, cid, sector, description)
where v.cid is not null
  and not exists (select 1 from public.companies c where c.name = v.name);

-- ---------------------------------------------------------------------------
-- 12. Seed: space capabilities (descriptive, sourced)
-- ---------------------------------------------------------------------------
insert into public.country_space_capabilities (
  country_id, domain, status, summary, source_url, evidence_level, source_id
)
select cid, domain, status, summary, source_url, 'reported',
  (select id from public.sources where publisher ilike '%Stockholm International Peace Research%' or title ilike '%Military Expenditure Database%' order by id limit 1)
from (
  values
    (public.country_id_from_iso('US'), 'space_force', 'operational',
     'United States Space Force (established 2019) is a separate service for space operations.',
     'https://www.spaceforce.mil/'),
    (public.country_id_from_iso('US'), 'orbital_launch', 'operational',
     'Sustained national and commercial orbital launch (Cape Canaveral, Vandenberg, and others).',
     'https://www.nasa.gov/'),
    (public.country_id_from_iso('US'), 'pnt', 'operational',
     'GPS is the US Global Positioning System, operated for civil and military users.',
     'https://www.gps.gov/'),
    (public.country_id_from_iso('US'), 'missile_warning', 'operational',
     'Overhead persistent infrared missile-warning satellites are a documented US Space Force mission area.',
     'https://www.spaceforce.mil/'),
    (public.country_id_from_iso('US'), 'ssa', 'operational',
     'US Space Command publishes space domain awareness as a core mission.',
     'https://www.spacecom.mil/'),
    (public.country_id_from_iso('CN'), 'orbital_launch', 'operational',
     'China conducts regular orbital launches and operates a national human spaceflight programme.',
     'https://www.cnsa.gov.cn/'),
    (public.country_id_from_iso('CN'), 'pnt', 'operational',
     'BeiDou is China''s global satellite navigation system.',
     'https://en.beidou.gov.cn/'),
    (public.country_id_from_iso('CN'), 'space_force', 'operational',
     'PLA Aerospace Force (reorganised 2024 from the Strategic Support Force) is the publicly named space-domain service.',
     'https://english.news.cn/'),
    (public.country_id_from_iso('RU'), 'orbital_launch', 'operational',
     'Russia retains orbital launch from Baikonur, Plesetsk and Vostochny.',
     'https://www.roscosmos.ru/'),
    (public.country_id_from_iso('RU'), 'pnt', 'operational',
     'GLONASS is the Russian global navigation satellite system.',
     'https://www.glonass-iac.ru/'),
    (public.country_id_from_iso('FR'), 'space_force', 'operational',
     'Commandement de l''Espace (French Space Command) was established in 2019.',
     'https://www.defense.gouv.fr/'),
    (public.country_id_from_iso('FR'), 'satcom', 'operational',
     'Syracuse is the French armed forces satellite communications programme.',
     'https://www.defense.gouv.fr/'),
    (public.country_id_from_iso('GB'), 'space_force', 'operational',
     'UK Space Command was stood up in 2021 as a joint command.',
     'https://www.gov.uk/government/organisations/uk-space-command'),
    (public.country_id_from_iso('GB'), 'satcom', 'operational',
     'Skynet is the UK military satellite communications constellation.',
     'https://www.gov.uk/government/organisations/uk-space-command'),
    (public.country_id_from_iso('IN'), 'orbital_launch', 'operational',
     'ISRO conducts national orbital launches including PSLV and LVM3.',
     'https://www.isro.gov.in/'),
    (public.country_id_from_iso('IN'), 'pnt', 'operational',
     'NavIC is India''s regional satellite navigation system.',
     'https://www.isro.gov.in/'),
    (public.country_id_from_iso('JP'), 'orbital_launch', 'operational',
     'Japan launches national payloads on H3 and related vehicles.',
     'https://global.jaxa.jp/'),
    (public.country_id_from_iso('JP'), 'pnt', 'operational',
     'QZSS (Michibiki) is Japan''s regional positioning overlay.',
     'https://qzss.go.jp/en/'),
    (public.country_id_from_iso('IL'), 'earth_observation', 'operational',
     'Israel operates national reconnaissance satellites in the Ofek series (publicly acknowledged programme).',
     'https://www.mod.gov.il/'),
    (public.country_id_from_iso('AU'), 'ssa', 'developing',
     'Australia is expanding space domain awareness under AUKUS Pillar II and national space strategy documents.',
     'https://www.defence.gov.au/')
) as s(cid, domain, status, summary, source_url)
where s.cid is not null
on conflict (country_id, domain) do nothing;
