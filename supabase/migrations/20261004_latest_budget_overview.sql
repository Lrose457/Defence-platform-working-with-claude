-- =============================================================================
-- latest_budget_overview: the atlas only needs each country's most recent
-- budget figure, but fetched all 2000+ budget rows and folded them client-
-- side. This view does the fold in Postgres (~200 rows instead of ~2300).
-- =============================================================================

create or replace view public.latest_budget_overview
with (security_invoker = true) as
select distinct on (country_id)
  country_id,
  year,
  amount_usd
from public.budgets
where amount_usd is not null
order by country_id, year desc;

grant select on public.latest_budget_overview to anon, authenticated;
