-- =============================================================================
-- Military installations — airfields, naval bases, ports, missile and radar
-- sites, plotted on the global atlas. Publicly documented sites only; every
-- row carries a source URL. Requires 20260929_country_profile_links.sql (for
-- the countries table this references) — run that first if not yet applied.
-- =============================================================================

create table if not exists public.military_installations (
  id             bigint generated always as identity primary key,
  name           text not null,
  type           text not null
                 check (type in (
                   'airfield', 'naval_base', 'army_base', 'port',
                   'missile_site', 'radar', 'other'
                 )),
  country_id     bigint not null references public.countries (id) on delete cascade,
  lat            numeric not null check (lat between -90 and 90),
  lng            numeric not null check (lng between -180 and 180),
  status         text,
  notes          text,
  source_url     text,
  evidence_level text not null default 'unverified',
  created_at     timestamptz not null default now()
);

create index if not exists military_installations_country_idx
  on public.military_installations (country_id);

alter table public.military_installations enable row level security;

drop policy if exists "public can read installations" on public.military_installations;
create policy "public can read installations"
  on public.military_installations for select using (true);

-- Operator country resolved by ISO code (see country_id_from_iso in the
-- 20260929 migration); rows are skipped if the country is missing.
insert into public.military_installations
  (name, type, country_id, lat, lng, status, notes, source_url, evidence_level)
select v.name, v.type, public.country_id_from_iso(v.iso), v.lat, v.lng,
       v.status, v.notes, v.source_url, 'documented'
from (
  values
    -- United States
    ('Naval Station Norfolk', 'naval_base', 'USA', 36.9496, -76.3301, 'Active',
     'Largest naval base in the world; headquarters of the US Atlantic Fleet.',
     'https://www.cnic.navy.mil/regions/ndw/installations/ns_norfolk.html'),
    ('Ramstein Air Base', 'airfield', 'USA', 49.4369, 7.6003, 'Active',
     'US Air Forces in Europe headquarters and airlift hub.',
     'https://www.ramstein.af.mil/'),
    ('Naval Base Guam', 'naval_base', 'USA', 13.4408, 144.6621, 'Active',
     'Forward-deployed US naval submarine base in the western Pacific.',
     'https://www.cnic.navy.mil/regions/jnb.html'),
    ('Camp Humphreys', 'army_base', 'USA', 36.9571, 127.0304, 'Active',
     'Largest overseas US military installation; HQ Eighth US Army, South Korea.',
     'https://home.army.mil/humphreys/'),
    ('Diego Garcia', 'naval_base', 'USA', -7.3195, 72.4229, 'Active',
     'Joint UK-US strategic airbase and naval support facility in the Indian Ocean.',
     'https://www.navy.mil/'),
    ('Camp Lemonnier', 'army_base', 'USA', 11.5487, 43.1592, 'Active',
     'Primary US base in the Horn of Africa, Djibouti.',
     'https://www.africom.mil/'),
    ('Al Udeid Air Base', 'airfield', 'USA', 25.1173, 51.3150, 'Active',
     'Major US air hub in Qatar hosting forward coalition headquarters.',
     'https://www.airforce.mil/'),
    ('Thule (Pituffik) Space Base', 'radar', 'USA', 76.5313, -68.7013, 'Active',
     'Northernmost US base; missile warning and space surveillance radar.',
     'https://www.spaceforce.mil/'),
    -- United Kingdom
    ('HMNB Clyde (Faslane)', 'naval_base', 'GBR', 56.0656, -4.8186, 'Active',
     'Home of the UK Continuous At-Sea Deterrent and the Submarine Service.',
     'https://www.royalnavy.mod.uk/'),
    ('RAF Akrotiri', 'airfield', 'GBR', 34.5908, 32.9889, 'Active',
     'UK sovereign base on Cyprus used for East Mediterranean operations.',
     'https://www.raf.mod.uk/'),
    ('Gibraltar Naval Base', 'port', 'GBR', 36.1408, -5.3536, 'Active',
     'UK naval base controlling the Strait of Gibraltar.',
     'https://www.royalnavy.mod.uk/'),
    -- France
    ('Base Navale de Toulon', 'naval_base', 'FRA', 43.1069, 5.9300, 'Active',
     'Principal French Mediterranean naval base; carrier Charles de Gaulle home port.',
     'https://www.defense.gouv.fr/marine'),
    ('Base Aérienne 113 Saint-Dizier', 'airfield', 'FRA', 48.6350, 4.9000, 'Active',
     'Home of the French nuclear-capable Rafale squadrons (Force Aérienne Stratique).',
     'https://www.defense.gouv.fr/air'),
    -- Russia
    ('Severomorsk Naval Base', 'naval_base', 'RUS', 69.0719, 33.4172, 'Active',
     'Main base of the Russian Northern Fleet on the Kola Peninsula.',
     'https://en.wikipedia.org/wiki/Severomorsk'),
    ('Tartus Naval Facility', 'port', 'RUS', 34.8955, 35.8833, 'Active',
     'Russian naval logistics facility on the Mediterranean coast of Syria.',
     'https://en.wikipedia.org/wiki/Russian_naval_facility_in_Tartus'),
    ('Kaliningrad (Chernyakhovsk)', 'airfield', 'RUS', 54.6033, 21.7900, 'Active',
     'Exclave airbase hosting missile-capable strike aviation.',
     'https://en.wikipedia.org/wiki/Kaliningrad_Oblast'),
    -- China
    ('Yulin Naval Base (Hainan)', 'naval_base', 'CHN', 18.2289, 109.6897, 'Active',
     'South Sea Fleet base with underground submarine pens on Hainan Island.',
     'https://en.wikipedia.org/wiki/Yulin_Naval_Base'),
    ('Ream Naval Base', 'port', 'CHN', 10.5106, 103.6100, 'Expanding',
     'Cambodian base with documented Chinese-backed expansion on the Gulf of Thailand.',
     'https://en.wikipedia.org/wiki/Ream_Naval_Base'),
    -- Australia / Japan / India / NATO
    ('HMAS Stirling', 'naval_base', 'AUS', -32.2314, 115.6789, 'Active',
     'Royal Australian Navy fleet base west; submarine base near Perth.',
     'https://www.navy.gov.au/'),
    ('Yokosuka Naval Base', 'naval_base', 'JPN', 35.2836, 139.6689, 'Active',
     'Home of the US 7th Fleet and JMSDF self-defence fleet.',
     'https://www.cnic.navy.mil/'),
    ('INS Kadamba (Karwar)', 'naval_base', 'IND', 14.8061, 74.1247, 'Active',
     'Indian Navy principal western seaboard base (Project Seabird).',
     'https://www.indiannavy.nic.in/'),
    ('Incirlik Air Base', 'airfield', 'TUR', 37.0017, 35.4258, 'Active',
     'NATO/US air base in southern Turkey.',
     'https://www.incirlik.af.mil/')
) as v(name, type, iso, lat, lng, status, notes, source_url)
where public.country_id_from_iso(v.iso) is not null
  and not exists (
    select 1 from public.military_installations existing where existing.name = v.name
  );
