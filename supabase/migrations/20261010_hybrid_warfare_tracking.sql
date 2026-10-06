-- =============================================================================
-- Hybrid Warfare tracking for the Global Atlas.
--
-- Incidents are harvested from European public broadcasters' newsfeeds,
-- auto-labelled as "possible" hybrid warfare, and funnelled through the
-- ingestion review queue (entity_type = 'hybrid_warfare_incident'). Reviewed
-- rows are materialised into the longitudinal `hybrid_warfare_incidents` table:
--
--   * approved  -> status = 'verified'   (corroborated / enriched)
--   * rejected   -> status = 'dropped'    (disproven; kept for the audit trail)
--
-- The map reads `atlas_hybrid_warfare`, which unions:
--   (a) verified rows from the longitudinal table, and
--   (b) live 'possible' candidates still pending review in ingestion_queue.
-- Dropped/disproven rows are suppressed from the live map but remain in the
-- table, so the dataset is genuinely longitudinal.
--
-- Definition source (per accepted plan): NATO glossary + EU JOIN(2016) 18
-- + EU HybNet / Hybrid CoE framework. The rule set in
-- data-pipeline/scripts/hybrid_classification.py encodes the same clauses so
-- pipeline and schema stay in lock-step.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Longitudinal table.
-- ---------------------------------------------------------------------------
create table if not exists public.hybrid_warfare_incidents (
  id                   bigserial primary key,
  external_id          text,
  country_id           bigint references public.countries (id) on delete set null,
  attacked_iso3        char(3),
  target_type          text check (target_type in ('military', 'civilian', 'dual')),
  lat                  numeric(9,6),
  lng                  numeric(9,6),
  title                text not null,
  summary              text,
  definition_clause    text,                  -- which sub-clause matched
  target_description   text,                  -- e.g. "regional power grid"
  government_response   text,                 -- recorded response, if any
  domains              jsonb default '[]'::jsonb,  -- definitional buckets that fired
  confidence_score     integer check (confidence_score between 0 and 100),
  status               text not null
                          check (status in ('possible', 'verified', 'dropped')),
  first_seen_at        timestamptz not null default now(),
  last_seen_at         timestamptz not null default now(),
  source_id            bigint references public.sources (id) on delete set null,
  source_url           text,
  evidence_urls        jsonb default '[]'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists hybrid_warfare_incidents_attacked_idx
  on public.hybrid_warfare_incidents (attacked_iso3);
create index if not exists hybrid_warfare_incidents_external_id_idx
  on public.hybrid_warfare_incidents (external_id);
create unique index if not exists hybrid_warfare_incidents_external_id_uq
  on public.hybrid_warfare_incidents (external_id)
  where external_id is not null;
create index if not exists hybrid_warfare_incidents_country_idx
  on public.hybrid_warfare_incidents (country_id);
create index if not exists hybrid_warfare_incidents_status_idx
  on public.hybrid_warfare_incidents (status);
create index if not exists hybrid_warfare_incidents_target_idx
  on public.hybrid_warfare_incidents (target_type);
create index if not exists hybrid_warfare_incidents_first_seen_idx
  on public.hybrid_warfare_incidents (first_seen_at desc);
create index if not exists hybrid_warfare_incidents_source_url_idx
  on public.hybrid_warfare_incidents (source_url);

-- RLS convention (20261007/20261008): table readable by the public roles,
-- writable only via the security-definer materialiser below / admin routes.
alter table public.hybrid_warfare_incidents enable row level security;
create policy "public can read hybrid_warfare_incidents"
  on public.hybrid_warfare_incidents for select using (true);
grant select on public.hybrid_warfare_incidents to anon, authenticated;

-- Resolve an ISO alpha-3 code to a country id. Stable; callable from the map.
create or replace function public.country_id_from_iso3(p_iso3 char(3))
returns bigint
language sql
stable
as $$
  select id from public.countries
  where iso_code = p_iso3
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- 2. Map feed view: verified (corroborated) + possible (live pending
--    candidates from the ingestion queue). Dropped/disproven are suppressed.
--    A live centroid can be derived client-side from attacked_iso3, since
--    broadcaster feeds rarely carry lat/lng.
-- ---------------------------------------------------------------------------
create or replace view public.atlas_hybrid_warfare
with (security_invoker = true) as
with reviewed as (
  select
    h.id,
    h.country_id,
    c.iso_code  as attacked_iso3,
    c.name      as attacked_name,
    h.target_type,
    h.lat,
    h.lng,
    h.title,
    h.summary,
    h.definition_clause,
    h.target_description,
    h.government_response,
    h.domains,
    h.confidence_score,
    h.status,
    h.first_seen_at,
    h.last_seen_at,
    h.source_url
  from public.hybrid_warfare_incidents h
  left join public.countries c on c.id = h.country_id
  where h.status = 'verified'
),
possible as (
  select
    q.id,
    null::bigint                                         as country_id,
    nullif(q.normalised_payload->>'attacked_iso3','')::char(3) as attacked_iso3,
    null                                                 as attacked_name,
    nullif(q.normalised_payload->>'target_type','')      as target_type,
    nullif(q.normalised_payload->>'lat','')::numeric    as lat,
    nullif(q.normalised_payload->>'lng','')::numeric    as lng,
    coalesce(q.title, q.normalised_payload->>'title')  as title,
    nullif(q.normalised_payload->>'summary','')        as summary,
    nullif(q.normalised_payload->>'definition_clause','') as definition_clause,
    nullif(q.normalised_payload->>'target_description','') as target_description,
    nullif(q.normalised_payload->>'government_response','') as government_response,
    (q.normalised_payload->'domains')::jsonb          as domains,
    q.confidence_score                                 as confidence_score,
    'possible'                                         as status,
    q.retrieved_at                                     as first_seen_at,
    now()                                              as last_seen_at,
    q.source_url
  from public.ingestion_queue q
  where q.entity_type = 'hybrid_warfare_incident'
    and q.review_status = 'pending'
)
select id, country_id, attacked_iso3, attacked_name, target_type, lat, lng,
       title, summary, definition_clause, target_description, government_response,
       domains, confidence_score, status, first_seen_at, last_seen_at, source_url
from reviewed
union all
select id, country_id, attacked_iso3, attacked_name, target_type, lat, lng,
       title, summary, definition_clause, target_description, government_response,
       domains, confidence_score, status, first_seen_at, last_seen_at, source_url
from possible;

grant select on public.atlas_hybrid_warfare to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Materialise reviewed ingestion-queue rows into the longitudinal table.
--    Mirrors materialise_conflicts: security-definer, anon-executable,
--    idempotent -- approved->'verified', rejected->'dropped', queue flipped
--    to 'applied' so re-running the same ids is a no-op.
-- ---------------------------------------------------------------------------
create or replace function public.materialise_hybrid_incidents(p_queue_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  q  record;
  p  jsonb;
  v_iso3       char(3);
  v_country_id bigint;
  v_status     text;
  v_count      integer := 0;
begin
  if p_queue_ids is null or array_length(p_queue_ids, 1) = 0 then
    return 0;
  end if;

  for q in
    select id, external_id, title, normalised_payload,
           source_url, source_id, confidence_score,
           review_status, retrieved_at
    from public.ingestion_queue
    where id = any (p_queue_ids)
      and entity_type = 'hybrid_warfare_incident'
      and external_id is not null
  loop
    p := q.normalised_payload;
    v_iso3 := nullif(p ->> 'attacked_iso3', '')::char(3);
    v_country_id := null;
    if v_iso3 is not null then
      select public.country_id_from_iso3(v_iso3) into v_country_id;
    end if;

    -- Map the review outcome to the longitudinal status ladder.
    v_status := case
                  when q.review_status = 'approved' then 'verified'
                  when q.review_status = 'rejected' then 'dropped'
                  else 'possible'
                end;

    insert into public.hybrid_warfare_incidents (
      external_id, country_id, attacked_iso3, target_type, lat, lng,
      title, summary, definition_clause, target_description,
      government_response, domains, confidence_score, status, source_url,
      source_id, first_seen_at, last_seen_at
    ) values (
      q.external_id, v_country_id, v_iso3,
      nullif(p ->> 'target_type', ''),
      nullif(p ->> 'lat', '')::numeric,
      nullif(p ->> 'lng', '')::numeric,
      coalesce(q.title, nullif(p ->> 'title', '')),
      nullif(p ->> 'summary', ''),
      nullif(p ->> 'definition_clause', ''),
      nullif(p ->> 'target_description', ''),
      nullif(p ->> 'government_response', ''),
      (q.normalised_payload->'domains')::jsonb,
      q.confidence_score, v_status, q.source_url, q.source_id,
      coalesce(q.retrieved_at, now()),
      now()
    ) on conflict (external_id) do update
      set status = excluded.status,
          last_seen_at = excluded.last_seen_at,
          confidence_score = excluded.confidence_score,
          country_id = coalesce(excluded.country_id,
                                hybrid_warfare_incidents.country_id),
          attacked_iso3 = coalesce(excluded.attacked_iso3,
                                   hybrid_warfare_incidents.attacked_iso3),
          target_type = coalesce(excluded.target_type,
                                 hybrid_warfare_incidents.target_type),
          government_response = coalesce(excluded.government_response,
                                         hybrid_warfare_incidents.government_response),
          domains = excluded.domains,
          definition_clause = coalesce(excluded.definition_clause,
                                       hybrid_warfare_incidents.definition_clause),
          summary = coalesce(excluded.summary, hybrid_warfare_incidents.summary),
          updated_at = now();

    v_count := v_count + 1;

    update public.ingestion_queue
      set review_status = 'applied'
    where id = q.id;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.materialise_hybrid_incidents(bigint[]) from public;
grant execute on function public.materialise_hybrid_incidents(bigint[]) to anon, authenticated;
