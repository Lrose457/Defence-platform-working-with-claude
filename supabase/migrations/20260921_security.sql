create table if not exists public.anonymous_search_logs (
  id bigint generated always as identity primary key,
  session_hash text not null,
  query_hash text not null,
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists anonymous_search_logs_created_at_idx
  on public.anonymous_search_logs (created_at);

create table if not exists public.privacy_requests (
  id bigint generated always as identity primary key,
  request_type text not null check (request_type in ('opt_out', 'deletion', 'access')),
  name text not null,
  email text not null,
  details text not null,
  status text not null default 'pending' check (status in ('pending', 'in_review', 'completed', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.anonymous_search_logs enable row level security;
alter table public.privacy_requests enable row level security;

revoke all on public.anonymous_search_logs from anon, authenticated;
revoke all on public.privacy_requests from anon, authenticated;

grant insert on public.anonymous_search_logs to anon, authenticated;
grant insert on public.privacy_requests to anon, authenticated;

create policy "anonymous clients insert hashed search logs"
  on public.anonymous_search_logs for insert
  to anon, authenticated
  with check (true);

create policy "public can submit privacy requests"
  on public.privacy_requests for insert
  to anon, authenticated
  with check (true);
