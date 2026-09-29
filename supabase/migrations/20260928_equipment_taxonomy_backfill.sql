-- =============================================================================
-- Backfill branch + sub_category on every ingested equipment row, so each
-- country page renders its inventory inside the Army / Navy / Air Force
-- taxonomy. Safe + idempotent:
--   * Only fills branch / sub_category where they are NULL (never overwrites
--     analyst-curated values).
--   * Resolves category_id lazily by slug where possible so the seed in
--     20260927 is not required to have run first; on live databases whose
--     equipment_categories table has a different shape (id/name/description
--     only), taxonomy resolution falls back to equipment names.
--   * Maps the LIVE holding status vocabulary (Active/Planned/Ordered/
--     Retired/Unknown + quantity_type) to the operational/maintenance
--     vocabulary consumed by the country page. Adds the operational columns
--     only if they are missing (live country_equipment uses quantity/
--     quantity_type/status instead).
-- Run with: supabase db push
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Defensive columns (only where missing on the live schema)
-- -----------------------------------------------------------------------------
alter table public.equipment
  add column if not exists branch text,
  add column if not exists sub_category text;

alter table public.country_equipment
  add column if not exists operational_qty integer,
  add column if not exists maintenance_qty integer,
  add column if not exists deployment_area text,
  add column if not exists activity text,
  add column if not exists activity_name text,
  add column if not exists operator_unit text,
  add column if not exists evidence_level text,
  add column if not exists last_verified_at timestamptz;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'equipment_categories'
      and column_name = 'slug'
  ) then
    alter table public.equipment_categories add column slug text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'equipment_categories'
      and column_name = 'branch'
  ) then
    alter table public.equipment_categories add column branch text;
  end if;
end;
$$;

create unique index if not exists equipment_categories_slug_unique
  on public.equipment_categories (slug);

-- -----------------------------------------------------------------------------
-- 2. Seed inventory taxonomy slugs (no-op where category rows already exist)
-- -----------------------------------------------------------------------------
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
-- 3. Backfill equipment.branch / sub_category for ingested systems.
--    Only fills NULL branch (never overwrites analyst values).
update public.equipment e
set branch = m.branch,
    sub_category = m.sub_category
from (values
 ('F-35 Lightning II', 'air_force', 'multi-role'),
 ('Eurofighter Typhoon', 'air_force', 'multi-role'),
 ('Challenger 2', 'army', 'tanks'),
 ('Leopard 2', 'army', 'tanks'),
 ('M1 Abrams', 'army', 'tanks'),
 ('CAESAR', 'army', 'artillery-sp'),
 ('Type 45', 'navy', 'destroyer'),
 ('Astute-class', 'navy', 'submarine-ssn'),
 ('Patriot', 'army', 'air-defence-land'),
 ('MQ-9 Reaper', 'air_force', 'uav-ucav'),
 ('Challenger 3', 'army', 'tanks'),
 ('Protector RG Mk1', 'air_force', 'uav-ucav'),
 ('Type 26 Frigate', 'navy', 'frigate')
) as m(name, branch, sub_category)
where e.name = m.name
  and e.branch is null;

-- Generic fallback for any other ingested equipment via legacy categories.
update public.equipment e
set branch = case lc.name
    when 'Aircraft' then 'air_force'
    when 'Armoured Vehicles' then 'army'
    when 'Artillery' then 'army'
    when 'Air Defence' then 'army'
    when 'Naval Vessels' then 'navy'
    when 'Submarines' then 'navy'
    when 'Missiles' then 'army'
    when 'Small Arms' then 'army'
    when 'Unmanned Systems' then 'air_force'
    when 'Support Vehicles' then 'army'
    else null end,
  sub_category = case lc.name
    when 'Aircraft' then 'multi-role'
    when 'Armoured Vehicles' then 'tanks'
    when 'Artillery' then 'artillery-sp'
    when 'Air Defence' then 'air-defence-land'
    when 'Naval Vessels' then 'frigate'
    when 'Submarines' then 'submarine-ssn'
    when 'Missiles' then 'mlrs'
    when 'Small Arms' then 'small-arms'
    when 'Unmanned Systems' then 'uav-ucav'
    when 'Support Vehicles' then 'engineering-logistics'
    else null end
from public.equipment_categories lc
where e.category_id = lc.id
  and e.branch is null;

-- 4. Resolve category_id to the fine taxonomy slugs (by branch/name).
update public.equipment e
set category_id = ec.id
from public.equipment_categories ec
where ec.slug = e.sub_category
  and e.category_id is distinct from ec.id
  and ec.slug is not null;

-- 5. Map live holding status to operational / maintenance splits.
--    Active+Inventory -> fully operational; Planned/Ordered -> 0/0;
--    Retired or qty 0 -> 0/0. Only where splits are still NULL.
update public.country_equipment ce
set operational_qty = ce.quantity,
    maintenance_qty = 0
where ce.status = 'Active'
  and coalesce(ce.quantity_type, 'Inventory') = 'Inventory'
  and ce.quantity is not null
  and ce.operational_qty is null;

update public.country_equipment ce
set operational_qty = 0,
    maintenance_qty = 0
where ce.status in ('Planned', 'Ordered')
  and ce.operational_qty is null;

update public.country_equipment ce
set operational_qty = 0,
    maintenance_qty = 0
where (ce.status = 'Retired' or ce.quantity = 0)
  and ce.operational_qty is null;

-- 6. Provenance default: single_source unless an analyst set better.
update public.country_equipment ce
set evidence_level = 'single_source'
where ce.evidence_level is null;

-- 7. country_equipment_overview reconciled with the LIVE table shape
--    (quantity / quantity_type / status / notes) plus the new splits.
create or replace view public.country_equipment_overview as
select ce.id as holding_id,
  ce.country_id,
  c.name as country_name,
  c.iso_code as country_iso,
  ce.equipment_id,
  e.name as equipment_name,
  e.branch,
  e.sub_category,
  ec.name as category_name,
  ce.quantity,
  ce.quantity_type,
  ce.operational_qty,
  ce.maintenance_qty,
  ce.status,
  ce.year,
  ce.deployment_area,
  ce.activity,
  ce.activity_name,
  ce.operator_unit,
  ce.notes,
  ce.source_id,
  s.title as source_title,
  coalesce(ce.evidence_level, 'single_source') as evidence_level,
  ce.last_verified_at,
  ce.confidence,
  ce.data_confidence
from public.country_equipment ce
join public.equipment e on e.id = ce.equipment_id
join public.countries c on c.id = ce.country_id
left join public.equipment_categories ec on ec.id = e.category_id
left join public.sources s on s.id = ce.source_id;

create or replace view public.country_inventory_summary as
select ce.country_id,
  e.branch,
  e.sub_category,
  ce.status,
  count(*) as holdings,
  coalesce(sum(ce.quantity), 0)::bigint as total_quantity,
  coalesce(sum(ce.operational_qty), 0)::bigint as operational_quantity,
  coalesce(sum(ce.maintenance_qty), 0)::bigint as maintenance_quantity
from public.country_equipment ce
join public.equipment e on e.id = ce.equipment_id
group by ce.country_id, e.branch, e.sub_category, ce.status;



