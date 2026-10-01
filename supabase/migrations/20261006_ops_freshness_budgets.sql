-- =============================================================================
-- ops_freshness_budgets: per-dataset staleness budgets for the /admin/ops
-- pipeline freshness monitor. Keeps the thresholds operator-editable instead
-- of hardcoded in lib/ops/telemetry.ts (which remains the fallback when the
-- table is missing or empty).
-- =============================================================================

create table if not exists public.ops_freshness_budgets (
  dataset text primary key,
  label text not null,
  budget_hours integer not null check (budget_hours between 1 and 8760),
  updated_at timestamptz not null default now()
);

insert into public.ops_freshness_budgets (dataset, label, budget_hours)
values
  ('conflicts', 'Conflicts (HIIK)', 72),
  ('ingestion_queue', 'Ingestion queue', 96),
  ('budgets', 'Budgets (SIPRI)', 336),
  ('contracts', 'Contracts', 840),
  ('country_equipment', 'Equipment holdings', 840)
on conflict (dataset) do nothing;

alter table public.ops_freshness_budgets enable row level security;

drop policy if exists "public can read ops_freshness_budgets" on public.ops_freshness_budgets;
create policy "public can read ops_freshness_budgets"
  on public.ops_freshness_budgets for select using (true);

-- Writes stay authenticated-only; the /admin/ops page additionally gates
-- on the analyst/admin role server-side.
drop policy if exists "analysts can manage ops_freshness_budgets" on public.ops_freshness_budgets;
create policy "analysts can manage ops_freshness_budgets"
  on public.ops_freshness_budgets for all
  to authenticated
  using (true)
  with check (true);

grant select on public.ops_freshness_budgets to anon, authenticated;
