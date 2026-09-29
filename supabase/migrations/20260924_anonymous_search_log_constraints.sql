alter table public.anonymous_search_logs
  add constraint anonymous_search_logs_session_hash_sha256
  check (session_hash ~ '^[0-9a-f]{64}$'),
  add constraint anonymous_search_logs_query_hash_sha256
  check (query_hash ~ '^[0-9a-f]{64}$');

comment on table public.anonymous_search_logs is
  'Privacy-preserving search telemetry. Contains no account identifiers or raw query text.';
comment on column public.anonymous_search_logs.session_hash is
  'Salted SHA-256 digest of an anonymous session token; never an account ID.';
comment on column public.anonymous_search_logs.query_hash is
  'Salted SHA-256 digest of normalized query text; raw queries are not stored.';
