-- Stable provenance records for the source adapters. Existing domain records
-- can continue to reference sources.id through the normal ingestion workflow.
alter table public.sources
  add column if not exists registry_id text;

create unique index if not exists sources_registry_id_unique
  on public.sources (registry_id)
  where registry_id is not null;

insert into public.sources (
  title,
  publisher,
  url,
  source_type,
  reliability,
  notes,
  registry_id
)
select
  source.title,
  source.publisher,
  source.url,
  source.source_type,
  source.reliability,
  source.notes,
  source.registry_id
from (
  values
    ('gleif', 'GLEIF Level 2', 'Global Legal Entity Identifier Foundation', 'https://www.gleif.org/en/lei-data/gleif-golden-copy', 'Ownership and sanctions', 'High', 'Existing Neo4j relationship importer.'),
    ('usaspending', 'USAspending', 'US government', 'https://www.usaspending.gov/', 'Procurement', 'High', 'Public API; no key required.'),
    ('sam-gov', 'SAM.gov', 'US government', 'https://sam.gov/content/opportunities', 'Procurement', 'High', 'Public contract opportunities.'),
    ('uk-contracts-finder', 'Contracts Finder', 'UK government', 'https://www.contractsfinder.service.gov.uk/', 'Procurement', 'High', 'Public procurement records.'),
    ('eu-ted', 'TED', 'European Union', 'https://ted.europa.eu/', 'Procurement', 'High', 'Public procurement notices.'),
    ('ofac', 'OFAC Sanctions', 'US Treasury', 'https://ofac.treasury.gov/sanctions-programs-and-country-information', 'Ownership and sanctions', 'High', 'Public designation lists.'),
    ('uk-sanctions', 'UK Sanctions List', 'UK government', 'https://www.gov.uk/government/publications/the-uk-sanctions-list', 'Ownership and sanctions', 'High', 'Public designation list.'),
    ('eu-sanctions', 'EU Sanctions Map', 'European Union', 'https://www.sanctionsmap.eu/', 'Ownership and sanctions', 'High', 'Public restrictive measures.'),
    ('un-sanctions', 'UN Security Council Sanctions', 'United Nations', 'https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list', 'Ownership and sanctions', 'High', 'Public consolidated list.'),
    ('ucdp', 'UCDP', 'Uppsala Conflict Data Program', 'https://ucdp.uu.se/', 'Conflict and deployment', 'High', 'Public conflict datasets.'),
    ('opensky', 'OpenSky Network', 'OpenSky Network', 'https://opensky-network.org/', 'Movement and logistics', 'Medium', 'Public API with rate limits.'),
    ('sipri', 'SIPRI', 'Stockholm International Peace Research Institute', 'https://www.sipri.org/databases', 'Defence research', 'High', 'Public datasets with attribution.'),
    ('acled', 'ACLED', 'Armed Conflict Location & Event Data', 'https://acleddata.com/', 'Conflict and deployment', 'High', 'API access required.'),
    ('companies-house', 'Companies House', 'UK government', 'https://developer.company-information.service.gov.uk/', 'Ownership and sanctions', 'High', 'API key required.'),
    ('opencorporates', 'OpenCorporates', 'OpenCorporates', 'https://opencorporates.com/', 'Ownership and sanctions', 'Medium', 'API key and usage limits apply.'),
    ('opensanctions', 'OpenSanctions', 'OpenSanctions', 'https://www.opensanctions.org/', 'Ownership and sanctions', 'High', 'API or licensed dataset.'),
    ('bellingcat', 'Bellingcat', 'Bellingcat', 'https://www.bellingcat.com/', 'Investigations', 'Medium', 'Curated research; manual ingestion.'),
    ('occrp', 'OCCRP and Aleph', 'Organized Crime and Corruption Reporting Project', 'https://aleph.occrp.org/', 'Investigations', 'Medium', 'Research platform with terms and rate limits.'),
    ('marinetraffic', 'MarineTraffic', 'Kpler', 'https://www.marinetraffic.com/', 'Movement and logistics', 'Medium', 'Commercial API subscription.'),
    ('janes', 'Janes', 'Janes Group', 'https://www.janes.com/', 'Defence research', 'High', 'Commercial subscription required.')
) as source(registry_id, title, publisher, url, source_type, reliability, notes)
where not exists (
  select 1
  from public.sources existing
  where existing.registry_id = source.registry_id
);

update public.sources existing
set registry_id = source.registry_id
from (
  values
    ('gleif', 'GLEIF Level 2'),
    ('usaspending', 'USAspending'),
    ('sam-gov', 'SAM.gov'),
    ('uk-contracts-finder', 'Contracts Finder'),
    ('eu-ted', 'TED'),
    ('ofac', 'OFAC Sanctions'),
    ('uk-sanctions', 'UK Sanctions List'),
    ('eu-sanctions', 'EU Sanctions Map'),
    ('un-sanctions', 'UN Security Council Sanctions'),
    ('ucdp', 'UCDP'),
    ('opensky', 'OpenSky Network'),
    ('sipri', 'SIPRI'),
    ('acled', 'ACLED'),
    ('companies-house', 'Companies House'),
    ('opencorporates', 'OpenCorporates'),
    ('opensanctions', 'OpenSanctions'),
    ('bellingcat', 'Bellingcat'),
    ('occrp', 'OCCRP and Aleph'),
    ('marinetraffic', 'MarineTraffic'),
    ('janes', 'Janes')
) as source(registry_id, title)
where existing.title = source.title
  and existing.registry_id is null;