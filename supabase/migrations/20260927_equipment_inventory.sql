-- Equipment inventory per country: Army / Navy / Air Force + AI in defence.
-- Run with: supabase db push
-- 1. Equipment categories taxonomy
create table if not exists public.equipment_categories (
  id bigint generated always as identity primary key,
  branch text not null check (branch in ('army','navy','air_force','joint')),
  name text not null,
  slug text not null,
  created_at timestamptz default now() not null
);
create unique index if not exists equipment_categories_slug_key on public.equipment_categories (slug);
create index if not exists equipment_categories_branch_idx on public.equipment_categories (branch);

-- Seed taxonomy (idempotent).
insert into public.equipment_categories (branch, name, slug)
select s.branch, s.name, s.slug from (values
 ('army','Small arms','small-arms'),
 ('army','Tanks','tanks'),
 ('army','AFVs / IFVs','afv-ifv'),
 ('army','APCs','apc'),
 ('army','Artillery (towed)','artillery-towed'),
 ('army','Artillery (self-propelled)','artillery-sp'),
 ('army','MLRS / Rocket artillery','mlrs'),
 ('army','Air defence (land)','air-defence-land'),
 ('army','Attack helicopters','attack-helicopter'),
 ('army','Transport helicopters','transport-helicopter'),
 ('army','UAVs (land)','uav-land'),
 ('army','Engineering / Logistics','engineering-logistics'),
 ('navy','Carriers','carrier'),
 ('navy','Destroyers','destroyer'),
 ('navy','Frigates','frigate'),
 ('navy','Corvettes / Patrol','corvette-patrol'),
 ('navy','Submarines (SSN)','submarine-ssn'),
 ('navy','Submarines (SSBN)','submarine-ssbn'),
 ('navy','Submarines (SSK)','submarine-ssk'),
 ('navy','Amphibious','amphibious'),
 ('navy','Auxiliaries','auxiliary'),
 ('navy','Mine warfare','mine-warfare'),
 ('navy','Naval aviation','naval-aviation'),
 ('air_force','Multi-role','multi-role'),
 ('air_force','Attack / Ground-attack','attack'),
 ('air_force','Transport','transport'),
 ('air_force','Tanker / Refuelling','tanker-refuelling'),
 ('air_force','AWACS / AEW&C','awacs-aew'),
 ('air_force','ISR / EW','isr-ew'),
 ('air_force','Trainers','trainer'),
 ('air_force','Helicopters','helicopter'),
 ('air_force','UAVs / UCAVs','uav-ucav'),
 ('air_force','Air defence (air)','air-defence-air')
) as s(branch,name,slug)
where not exists (select 1 from public.equipment_categories e where e.slug = s.slug);

-- 2. Equipment display columns used by app/equipment/page.tsx
alter table public.equipment add column if not exists category_id bigint references public.equipment_categories(id);
alter table public.equipment add column if not exists branch text;
alter table public.equipment add column if not exists sub_category text;
alter table public.equipment add column if not exists manufacturer text;
alter table public.equipment add column if not exists country_of_origin text;
alter table public.equipment add column if not exists description text;
alter table public.equipment add column if not exists confidence text;
alter table public.equipment add column if not exists image_url text;
create index if not exists equipment_category_id_idx on public.equipment (category_id);
create index if not exists equipment_branch_idx on public.equipment (branch);
create index if not exists equipment_sub_category_idx on public.equipment (sub_category);

-- 3. country_equipment holdings: surrogate key for per-hull rows
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'country_equipment_pkey'
    and conrelid = 'public.country_equipment'::regclass) then
    alter table public.country_equipment drop constraint country_equipment_pkey;
  end if;
end;
$$;
alter table public.country_equipment add column if not exists id bigint generated always as identity;
alter table public.country_equipment add column if not exists hull_name text;
alter table public.country_equipment add column if not exists variant text;
alter table public.country_equipment add column if not exists quantity integer;
alter table public.country_equipment add column if not exists operational_qty integer;
alter table public.country_equipment add column if not exists maintenance_qty integer;
alter table public.country_equipment add column if not exists status text default 'unknown';
alter table public.country_equipment add column if not exists deployment_area text;
alter table public.country_equipment add column if not exists deployment_lat numeric;
alter table public.country_equipment add column if not exists deployment_lon numeric;
alter table public.country_equipment add column if not exists activity text default 'undisclosed';
alter table public.country_equipment add column if not exists activity_name text;
alter table public.country_equipment add column if not exists operator_unit text;
alter table public.country_equipment add column if not exists acquisition_year integer;
alter table public.country_equipment add column if not exists retirement_year integer;
alter table public.country_equipment add column if not exists source_id bigint references public.sources (id);
alter table public.country_equipment add column if not exists confidence text;
alter table public.country_equipment add column if not exists evidence_level text default 'unverified';
alter table public.country_equipment add column if not exists last_verified_at timestamptz;
alter table public.country_equipment add column if not exists conflict_id bigint references public.conflicts (id);
alter table public.country_equipment add column if not exists created_at timestamptz default now() not null;
alter table public.country_equipment add column if not exists updated_at timestamptz default now() not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'country_equipment_pkey'
    and conrelid = 'public.country_equipment'::regclass) then
    alter table public.country_equipment add primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'country_equipment_holding_unique'
    and conrelid = 'public.country_equipment'::regclass) then
    alter table public.country_equipment
      add constraint country_equipment_holding_unique unique (country_id, equipment_id, hull_name);
  end if;
end;
$$;
create index if not exists country_equipment_country_idx on public.country_equipment (country_id);
create index if not exists country_equipment_equipment_idx on public.country_equipment (equipment_id);
create index if not exists country_equipment_status_idx on public.country_equipment (status);
create index if not exists country_equipment_activity_idx on public.country_equipment (activity);

-- contract_equipment columns used by app/equipment/[id]/page.tsx
alter table public.contract_equipment add column if not exists quantity integer;
alter table public.contract_equipment add column if not exists notes text;
alter table public.programme_equipment add column if not exists quantity integer;
alter table public.programme_equipment add column if not exists notes text;

-- 4. Training exercises (separate from conflicts)
create table if not exists public.training_exercises (
  id bigint generated always as identity primary key,
  name text not null,
  led_by_country_id bigint references public.countries (id),
  start_date date,
  end_date date,
  area text,
  description text,
  source_id bigint references public.sources (id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index if not exists training_exercises_country_idx on public.training_exercises (led_by_country_id);
alter table public.country_equipment add column if not exists exercise_id bigint references public.training_exercises (id);
create index if not exists country_equipment_exercise_idx on public.country_equipment (exercise_id);
create index if not exists country_equipment_conflict_idx on public.country_equipment (conflict_id);

-- 5. Carrier air wings (child of a carrier holding)
create table if not exists public.carrier_air_wings (
  id bigint generated always as identity primary key,
  country_id bigint references public.countries (id) on delete cascade,
  carrier_holding_id bigint references public.country_equipment (id) on delete set null,
  wing_name text not null,
  rated_capacity integer,
  current_aircraft_count integer,
  readiness text default 'unknown',
  deployment_area text,
  activity text default 'undisclosed',
  activity_name text,
  conflict_id bigint references public.conflicts (id),
  exercise_id bigint references public.training_exercises (id),
  source_id bigint references public.sources (id),
  evidence_level text default 'unverified',
  last_verified_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index if not exists carrier_air_wings_country_idx on public.carrier_air_wings (country_id);
create index if not exists carrier_air_wings_carrier_idx on public.carrier_air_wings (carrier_holding_id);
create table if not exists public.carrier_air_wing_aircraft (
  wing_id bigint references public.carrier_air_wings (id) on delete cascade,
  equipment_id bigint references public.equipment (id) on delete cascade,
  quantity integer,
  primary key (wing_id, equipment_id)
);

-- 6. AI in defence: government programmes x company products
create table if not exists public.ai_defence_projects (
  id bigint generated always as identity primary key,
  country_id bigint references public.countries (id) on delete cascade,
  programme_name text not null,
  domain text not null default 'other',
  status text not null default 'research',
  lead_agency text,
  company_id bigint references public.companies (id),
  programme_id bigint references public.programmes (id),
  contract_id bigint references public.contracts (id),
  description text,
  source_id bigint references public.sources (id),
  evidence_level text default 'unverified',
  last_verified_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index if not exists ai_defence_projects_country_idx on public.ai_defence_projects (country_id);
create index if not exists ai_defence_projects_company_idx on public.ai_defence_projects (company_id);
create index if not exists ai_defence_projects_domain_idx on public.ai_defence_projects (domain);
create index if not exists ai_defence_projects_status_idx on public.ai_defence_projects (status);

-- 7. Analytical views (distinct names: no collision with base tables)
create or replace view public.country_equipment_overview as
select ce.id as holding_id, ce.country_id, c.name as country_name, c.iso_code as country_iso,
 ce.equipment_id, e.name as equipment_name, e.branch, e.sub_category, ec.name as category_name,
 ce.hull_name, ce.variant, ce.quantity, ce.operational_qty, ce.maintenance_qty, ce.status,
 ce.deployment_area, ce.activity, ce.activity_name, ce.operator_unit,
 ce.conflict_id, ce.exercise_id, ce.evidence_level, ce.last_verified_at, s.title as source_title
from public.country_equipment ce
join public.equipment e on e.id = ce.equipment_id
join public.countries c on c.id = ce.country_id
left join public.equipment_categories ec on ec.id = e.category_id
left join public.sources s on s.id = ce.source_id;

create or replace view public.country_inventory_summary as
select ce.country_id, e.branch, e.sub_category, ce.status,
 count(*) as holdings,
 coalesce(sum(ce.quantity), 0)::bigint as total_quantity,
 coalesce(sum(ce.operational_qty), 0)::bigint as operational_quantity,
 coalesce(sum(ce.maintenance_qty), 0)::bigint as maintenance_quantity
from public.country_equipment ce
join public.equipment e on e.id = ce.equipment_id
group by ce.country_id, e.branch, e.sub_category, ce.status;

create or replace view public.carrier_air_wing_overview as
select w.id as wing_id, w.country_id, c.name as country_name, w.wing_name,
 ce.hull_name as carrier_hull, e.name as carrier_class,
 w.rated_capacity, w.current_aircraft_count, w.readiness,
 w.deployment_area, w.activity, w.activity_name, w.evidence_level,
 case when w.rated_capacity is null or w.rated_capacity <= 0 or w.current_aircraft_count is null then 'unknown'
  when w.current_aircraft_count::numeric / w.rated_capacity >= 0.95 then 'full'
  when w.current_aircraft_count::numeric / w.rated_capacity >= 0.70 then 'partial'
  else 'under-strength' end as capacity_state
from public.carrier_air_wings w
join public.countries c on c.id = w.country_id
left join public.country_equipment ce on ce.id = w.carrier_holding_id
left join public.equipment e on e.id = ce.equipment_id;

create or replace view public.ai_defence_project_overview as
select p.id, p.country_id, c.name as country_name, p.programme_name, p.domain, p.status,
 p.lead_agency, p.company_id, co.name as company_name, p.programme_id, pr.name as programme_link_name,
 p.contract_id, ct.title as contract_title, p.description, p.evidence_level, p.last_verified_at, s.title as source_title
from public.ai_defence_projects p
join public.countries c on c.id = p.country_id
left join public.companies co on co.id = p.company_id
left join public.programmes pr on pr.id = p.programme_id
left join public.contracts ct on ct.id = p.contract_id
left join public.sources s on s.id = p.source_id;

-- 8. RLS
alter table public.equipment_categories enable row level security;
alter table public.training_exercises enable row level security;
alter table public.carrier_air_wings enable row level security;
alter table public.carrier_air_wing_aircraft enable row level security;
alter table public.ai_defence_projects enable row level security;
drop policy if exists "public can read equipment_categories" on public.equipment_categories;
create policy "public can read equipment_categories" on public.equipment_categories for select using (true);
drop policy if exists "public can read training_exercises" on public.training_exercises;
create policy "public can read training_exercises" on public.training_exercises for select using (true);
drop policy if exists "public can read carrier_air_wings" on public.carrier_air_wings;
create policy "public can read carrier_air_wings" on public.carrier_air_wings for select using (true);
drop policy if exists "public can read carrier_air_wing_aircraft" on public.carrier_air_wing_aircraft;
create policy "public can read carrier_air_wing_aircraft" on public.carrier_air_wing_aircraft for select using (true);
drop policy if exists "public can read ai_defence_projects" on public.ai_defence_projects;
create policy "public can read ai_defence_projects" on public.ai_defence_projects for select using (true);

-- 9. updated_at triggers
create trigger if not exists training_exercises_updated_at_trigger
 before update on public.training_exercises for each row execute function public.set_updated_at();
create trigger if not exists carrier_air_wings_updated_at_trigger
 before update on public.carrier_air_wings for each row execute function public.set_updated_at();
create trigger if not exists ai_defence_projects_updated_at_trigger
 before update on public.ai_defence_projects for each row execute function public.set_updated_at();




