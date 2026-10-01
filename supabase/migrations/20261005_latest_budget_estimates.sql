-- =============================================================================
-- latest_budget_overview: expose is_estimate so the countries index can keep
-- its "(2025 est.)" annotation after moving to the view-backed API. Adding a
-- column to a view is backward-compatible for existing consumers (/map).
-- =============================================================================

create or replace view public.latest_budget_overview
with (security_invoker = true) as
select distinct on (country_id)
  country_id,
  year,
  amount_usd,
  is_estimate
from public.budgets
where amount_usd is not null
order by country_id, year desc;

grant select on public.latest_budget_overview to anon, authenticated;
