-- =============================================================================
-- SIPRI Arms Transfers Database (volume of transfers of major arms).
--
-- Motivation: the schema declared no table for international arms transfers.
-- `public.exports` is a per-user generated-CSV log (user_id, export_type,
-- format, row_count) and must NOT be used for transfer records. This adds a
-- dedicated table instead.
--
-- SIPRI Arms Transfers is a distinct product from the Military Expenditure
-- Database already loaded into `public.budgets`. Do not conflate them: the two
-- answer different questions and use different units.
--
-- Units
-- -----
-- SIPRI publishes volumes in trend-indicator values (TIV), measured in
-- millions. TIV is a volume index of weapon capability, NOT currency, and is
-- explicitly not comparable to financial value. The column is therefore named
-- `tiv_millions` rather than `amount` so it can never be mistaken for USD or
-- aggregated with `budgets.amount_usd`.
--
-- Source convention (SIPRI Arms Transfers Database):
--   '0'  -> volume between 0 and 0.5 million TIV
--   '..' -> value not available
--   ''   -> no deliveries identified
-- The importer maps these to `tiv_millions` plus the `tiv_status` column rather
-- than coercing them to zero, which would understate transfers.
--
-- Run with: supabase db push
-- =============================================================================

create table if not exists public.arms_transfers (
  id            bigint generated always as identity primary key,

  -- The transfer year. SIPRI publishes 2000 onward for this dataset.
  year          integer not null,

  -- Direction, relative to the reporting state.
  --   'import' -> this country received the weapons (SIPRI recipient view)
  --   'export' -> this country supplied the weapons (SIPRI supplier view)
  direction     text not null check (direction in ('import', 'export')),

  -- SIPRI state or entity name exactly as published, kept verbatim because the
  -- publisher's own grouping ("Other NATO countries", "Various countries")
  -- carries meaning that a country_id join would destroy.
  country_name  text not null,

  -- Resolved link to `public.countries` where the name matches a known state.
  -- Null for aggregate groupings that are not a single country.
  country_id    bigint references public.countries (id),

  -- Volume in millions of SIPRI trend-indicator values.
  tiv_millions  numeric,

  -- How to read tiv_millions, following SIPRI's published conventions.
  --   'value'       -> a numeric TIV figure
  --   'lt_half'     -> '0' in the source, i.e. between 0 and 0.5 million TIV
  --   'none'        -> no deliveries identified
  --   'unavailable' -> SIPRI marked the value '..'
  --   'unknown'     -> cell was blank in a way the parser could not classify
  tiv_status    text not null default 'value'
                  check (tiv_status in ('value', 'lt_half', 'none', 'unavailable', 'unknown')),

  source_id     bigint references public.sources (id),
  source_url    text,
  retrieved_at  timestamptz,

  data_confidence text,
  notes           text,

  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null,

  -- One row per country, direction and year. Re-importing the same SIPRI
  -- export therefore updates rather than duplicates.
  unique (year, direction, country_name)
);

create index if not exists arms_transfers_year_idx
  on public.arms_transfers (year);

create index if not exists arms_transfers_country_idx
  on public.arms_transfers (country_id);

create index if not exists arms_transfers_direction_idx
  on public.arms_transfers (direction);

-- Net transfer position per country and year: exports minus imports, in TIV.
-- This is a derived platform view, not a SIPRI-published figure.
create or replace view public.arms_transfer_balance as
select
  year,
  country_id,
  country_name,
  sum(case when direction = 'export' then coalesce(tiv_millions, 0) else 0 end) as exports_tiv_millions,
  sum(case when direction = 'import' then coalesce(tiv_millions, 0) else 0 end) as imports_tiv_millions,
  sum(case when direction = 'export' then coalesce(tiv_millions, 0) else 0 end)
    - sum(case when direction = 'import' then coalesce(tiv_millions, 0) else 0 end) as balance_tiv_millions
from public.arms_transfers
group by year, country_id, country_name;

-- Row level security, matching the pattern used for the other public read-only
-- domain tables in 20260926_full_schema.sql.
alter table public.arms_transfers enable row level security;

drop policy if exists "arms_transfers public read" on public.arms_transfers;
create policy "arms_transfers public read"
  on public.arms_transfers for select using (true);
