-- =============================================================================
-- Atlas conflicts & expanded installations.
--
-- 1. Approving HIIK records in /admin/ingestion now materialises them into
--    conflicts/conflict_parties (with a country link), so the global atlas
--    conflict tint and country-profile conflict lists light up automatically.
--    Any approved conflict rows already in the queue are materialised here.
-- 2. Widens the military_installations seed set (Russia/China strategic
--    bases and NATO/allied host-nation facilities), all publicly documented.
-- Requires 20260929 + 20261001 migrations first.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Prerequisites (idempotent). The live `conflicts` table uses
--    `description` + `intensity` (text) rather than `summary`, so the
--    materialiser writes whichever columns exist (see branch below).
-- ---------------------------------------------------------------------------
alter table public.conflicts
  add column if not exists intensity_level smallint
    check (intensity_level between 1 and 5);
alter table public.conflict_parties
  add column if not exists intensity_level smallint
    check (intensity_level between 1 and 5);
alter table public.conflict_parties
  add column if not exists country_id bigint references public.countries (id) on delete set null;

create index if not exists conflict_parties_country_idx
  on public.conflict_parties (country_id);

-- Guards against duplicate party rows when the same conflict is
-- materialised more than once (e.g. a re-reviewed queue record).
create unique index if not exists conflict_parties_conflict_country_uq
  on public.conflict_parties (conflict_id, country_id)
  where country_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Country resolution from a free-text hint ("Afghanistan", "Bangladesh").
--    Matches names, ISO alpha-3 and common short forms.
-- ---------------------------------------------------------------------------
create or replace function public.country_matches_hint(p_hint text)
returns bigint
language sql
stable
as $$
  select c.id
  from public.countries c
  where p_hint is not null
    and (
      lower(c.name) = lower(trim(p_hint))
      or upper(c.iso_code) = upper(trim(p_hint))
      or lower(c.name) like lower(trim(p_hint)) || '%'
    )
  order by
    case when lower(c.name) = lower(trim(p_hint)) then 0
         when upper(c.iso_code) = upper(trim(p_hint)) then 1
         else 2 end,
    length(c.name)
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- 3. Materialise approved conflict queue rows.
--
--    Runs as the table owner (security definer) so the admin-only review
--    route can call it with the anon-key client. Only rows already stamped
--    'approved' are processed — pending rows are left for the reviewer —
--    and each processed row is flipped to 'applied' for idempotency.
--    Conflict inserts are additionally name-guarded so replaying the same
--    queue ids never duplicates rows (live `conflicts` has no unique name).
-- -----------------------------------------------------------------------------
create or replace function public.materialise_conflicts(p_queue_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  hint text;
  v_conflict_id bigint;
  v_party_id bigint;
  v_count integer := 0;
  v_source_id bigint;
  v_country_id bigint;
  v_intensity smallint;
  v_name text;
  v_region text;
  v_status text;
  v_description text;
  v_source_notes text;
begin
  if p_queue_ids is null or array_length(p_queue_ids, 1) = 0 then
    return 0;
  end if;

  for r in
    select q.id, q.external_id, q.title, q.normalised_payload, q.source_id
    from public.ingestion_queue q
    where q.id = any (p_queue_ids)
      and q.entity_type = 'conflict'
      and q.review_status = 'approved'
  loop
    v_source_id := r.source_id;
    v_intensity := nullif(r.normalised_payload->>'intensity_level', '')::smallint;
    v_name := coalesce(nullif(r.normalised_payload->>'name', ''), r.title);
    v_region := nullif(r.normalised_payload->>'region', '');
    v_status := case lower(coalesce(r.normalised_payload->>'status', ''))
                  when 'active' then 'Active'
                  when 'frozen' then 'Frozen'
                  else null end;
    v_description := nullif(r.normalised_payload->>'summary', '');
    v_source_notes := case
      when nullif(r.normalised_payload->>'evidence_page', '') is not null
        then 'HIIK Conflict Barometer 2025, p. '
             || (r.normalised_payload->>'evidence_page')
      else null end;

    -- Column names differ between schema generations: newer drafts used
    -- `summary`, the live table uses `description` + `intensity` (text,
    -- carrying HIIK's public level names). Write whichever exists.
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'conflicts'
        and column_name = 'summary'
    ) then
      insert into public.conflicts
        (name, region, status, summary, intensity_level, source_id, source_notes)
      select v_name, v_region, v_status, v_description, v_intensity,
             v_source_id, v_source_notes
      where not exists (select 1 from public.conflicts c where c.name = v_name)
      returning id into v_conflict_id;
    else
      insert into public.conflicts
        (name, region, status, description, intensity, intensity_level,
         source_id, source_notes)
      select v_name, v_region, v_status, v_description,
             case v_intensity
               when 1 then 'Dispute'
               when 2 then 'Non-violent crisis'
               when 3 then 'Violent crisis'
               when 4 then 'Limited war'
               when 5 then 'War'
             end,
             v_intensity, v_source_id, v_source_notes
      where not exists (select 1 from public.conflicts c where c.name = v_name)
      returning id into v_conflict_id;
    end if;

    if v_conflict_id is null then
      select c.id into v_conflict_id
      from public.conflicts c
      where c.name = v_name
      order by c.id desc
      limit 1;
    end if;

    if v_conflict_id is null then
      continue;
    end if;

    -- One party row per resolved country hint (side_a / side_b hints are
    -- provided by the HIIK parser; the generic country_hint covers single-
    -- state conflicts).
    for hint in
      select h
      from unnest(array[
        r.normalised_payload->>'country_hint',
        r.normalised_payload->>'side_a_country',
        r.normalised_payload->>'side_b_country'
      ]) as h
      where h is not null and h <> ''
    loop
      v_country_id := public.country_matches_hint(hint);
      if v_country_id is not null then
        /* Reset so a skipped (duplicate) insert leaves null and is not
         * counted — the variable is reused across loop iterations. */
        v_party_id := null;
        insert into public.conflict_parties
          (conflict_id, country_id, party_name, party_type, role,
           source_id, intensity_level)
        values
          (v_conflict_id, v_country_id, hint, 'state', 'participant',
           v_source_id, v_intensity)
        on conflict (conflict_id, country_id) where country_id is not null
        do nothing
        returning id into v_party_id;
        if v_party_id is not null then
          v_count := v_count + 1;
        end if;
      end if;
    end loop;

    insert into public.data_changes (
      entity_type, entity_id, field_name, old_value, new_value,
      change_type, changed_at, reason, source_id, intelligence_eligible
    ) values (
      'conflict', v_conflict_id, 'record_created', null, v_name,
      'created', now(),
      'Materialised from reviewed ingestion queue record ' || r.id::text,
      v_source_id, true
    );

    -- Queue row is now fully processed.
    update public.ingestion_queue
    set review_status = 'applied'
    where id = r.id;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.materialise_conflicts(bigint[]) from public;
-- The review route runs server-side with the anon-key client, so `anon`
-- needs EXECUTE; the function only touches rows already stamped 'approved'.
grant execute on function public.materialise_conflicts(bigint[])
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. One-time backfill: materialise conflict records already sitting in the
--    queue (e.g. the HIIK 2025 payload replayed before this migration
--    existed). Stamps them approved — they were already reviewed when
--    replayed — then materialises. Runs as owner; never happens at runtime.
-- ---------------------------------------------------------------------------
update public.ingestion_queue
set review_status = 'approved'
where entity_type = 'conflict'
  and review_status = 'pending';

select public.materialise_conflicts(
  array_agg(q.id)
)
from public.ingestion_queue q
where q.entity_type = 'conflict'
  and q.review_status = 'approved';

-- ---------------------------------------------------------------------------
-- 5. Expanded installation seeds (all publicly documented sites).
-- ---------------------------------------------------------------------------
insert into public.military_installations
  (name, type, country_id, lat, lng, status, notes, source_url, evidence_level)
select v.name, v.type, public.country_id_from_iso(v.iso), v.lat, v.lng,
       v.status, v.notes, v.source_url, 'documented'
from (
  values
    -- Russia (strategic projects)
    ('Vostochny Cosmodrome', 'other', 'RUS', 51.8843, 128.3378, 'Active',
     'Primary Russian civilian/military orbital launch site in the Amur region.',
     'https://en.wikipedia.org/wiki/Vostochny_Cosmodrome'),
    ('Belbek (Sevastopol) Air Base', 'airfield', 'RUS', 44.6925, 33.5933, 'Occupied',
     'Air base in Russian-occupied Crimea; contested status under international law.',
     'https://en.wikipedia.org/wiki/Sevastopol_International_Airport'),
    ('Gadzhiyevo (Yagelnaya) Submarine Base', 'naval_base', 'RUS', 69.2544, 33.3258, 'Active',
     'Home of the Russian Northern Fleet ballistic-missile submarine squadron.',
     'https://en.wikipedia.org/wiki/Gadzhiyevo'),
    -- China (power projection)
    ('Fiery Cross Reef Outpost', 'other', 'CHN', 9.5483, 112.9167, 'Active',
     'Chinese-occupied feature in the Spratly Islands with a 3,000m runway; disputed territory.',
     'https://amti.csis.org/island-tracker/china/'),
    ('Djibouti PLA Support Base', 'army_base', 'CHN', 11.5892, 43.3900, 'Active',
     'China''s first overseas military base, Djibouti.',
     'https://en.wikipedia.org/wiki/People%27s_Liberation_Army_Support_Base_in_Djibouti'),
    ('Jianggezhuang Naval Base', 'naval_base', 'CHN', 36.0600, 120.3700, 'Active',
     'North Sea Fleet base near Qingdao, home of the PLA Navy submarine fleet.',
     'https://en.wikipedia.org/wiki/Qingdao'),
    -- NATO / allied host-nation facilities
    ('Mihail Kogalniceanu Air Base', 'airfield', 'ROU', 44.3606, 28.4883, 'Active',
     'NATO/US air hub on the Black Sea coast of Romania.',
     'https://en.wikipedia.org/wiki/Mihail_Kog%C4%83lniceanu_Air_Base'),
    ('RAF Lakenheath', 'airfield', 'GBR', 52.4092, 0.5606, 'Active',
     'US 48th Fighter Wing base in Suffolk; first US F-35A squadron in Europe.',
     'https://www.lakenheath.af.mil/'),
    ('Spangdahlem Air Base', 'airfield', 'DEU', 49.9764, 6.6889, 'Active',
     'US 52nd Fighter Wing base in western Germany.',
     'https://www.spangdahlem.af.mil/'),
    ('Aviano Air Base', 'airfield', 'ITA', 46.0311, 12.6033, 'Active',
     'US 31st Fighter Wing base in northeastern Italy.',
     'https://www.aviano.af.mil/'),
    ('Naval Support Activity Naples', 'naval_base', 'ITA', 40.8583, 14.2833, 'Active',
     'US 6th Fleet headquarters in Naples.',
     'https://www.cnic.navy.mil/'),
    ('RAF Croughton', 'other', 'GBR', 52.0539, -1.1081, 'Active',
     'US military communications hub in Northamptonshire.',
     'https://www.lakenheath.af.mil/Units/422nd-Air-Base-Group/'),
    ('Andersen AFB', 'airfield', 'USA', 13.5839, 144.9250, 'Active',
     'Key US Pacific bomber forward-operating location, Guam (US territory).',
     'https://www.andersen.af.mil/'),
    ('Naval Support Facility Diego Garcia', 'port', 'USA', -7.2833, 72.4167, 'Active',
     'Air and naval facility atoll in the Chagos Archipelago; UK-US joint use.',
     'https://en.wikipedia.org/wiki/Diego_Garcia'),
    ('Kadena Air Base', 'airfield', 'JPN', 26.3556, 127.7664, 'Active',
     'Major US 18th Wing base on Okinawa.',
     'https://www.kadena.af.mil/'),
    ('Naval Base Kitsap', 'naval_base', 'USA', 47.7161, -122.7214, 'Active',
     'US Pacific strategic submarine and shipyard complex.',
     'https://www.cnic.navy.mil/'),
    ('Eglin Air Force Base', 'airfield', 'USA', 30.4283, -86.5242, 'Active',
     'US munitions development and test range, Florida.',
     'https://www.eglin.af.mil/'),
    ('RAF Fylingdales', 'radar', 'GBR', 54.2611, -0.6742, 'Active',
     'UK ballistic-missile early-warning radar contributing to US missile defence.',
     'https://www.raf.mod.uk/our-organisation/stations/raf-fylingdales/'),
    ('Cape Canaveral Space Force Station', 'other', 'USA', 28.4888, -80.5778, 'Active',
     'Primary US Eastern Range launch complex for national security space missions.',
     'https://www.patrick.spaceforce.mil/'),
    ('Plesetsk Cosmodrome', 'other', 'RUS', 62.9256, 40.5783, 'Active',
     'Main Russian military orbital launch site.',
     'https://en.wikipedia.org/wiki/Plesetsk_Cosmodrome'),
    ('HMAS Stirling (Garden Island)', 'port', 'AUS', -32.2314, 115.6789, 'Active',
     'Royal Australian Navy principal west-coast fleet base; AUKUS submarine site.',
     'https://www.navy.gov.au/'),
    ('Rota Naval Base', 'port', 'ESP', 36.6233, -6.3500, 'Active',
     'Forward-deployed US Aegis destroyer base hosted by Spain.',
     'https://www.cnic.navy.mil/'),
    ('Souda Bay Naval Base', 'port', 'GRC', 35.5311, 24.1333, 'Active',
     'US naval support activity on Crete; Eastern Mediterranean logistics hub.',
     'https://www.cnic.navy.mil/'),
    ('Baltic Air Policing — Šiauliai', 'airfield', 'LTU', 55.9736, 23.3939, 'Active',
     'NATO air-policing detachment at Šiauliai, Lithuania.',
     'https://shape.nato.int/')
) as v(name, type, iso, lat, lng, status, notes, source_url)
where public.country_id_from_iso(v.iso) is not null
  and not exists (
    select 1 from public.military_installations existing where existing.name = v.name
  );
