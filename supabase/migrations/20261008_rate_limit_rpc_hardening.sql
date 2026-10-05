-- Harden the anon-executable rate-limit RPCs.
--
-- Both functions are SECURITY DEFINER (they must write to the counter
-- table on behalf of the public anon client) and anon-executable by
-- design. That makes the key argument a public write surface:
--
--   1. Without validation, anyone holding the anon key could flood
--      rate_limit_counters with arbitrary keys (storage growth) or
--      increment counters for guessed keys (lock other clients out).
--      Keys are now bounded to 1–200 chars of [A-Za-z0-9._:/@-] — the
--      exact shape the app produces (sha256 hex fingerprints, scope
--      prefixes, and pathnames such as /api/search).
--   2. Window lengths are bounded to 1s–24h so a caller cannot create
--      effectively immortal windows.
--   3. `advance_rate_limit_window` now trims every row older than 24h
--      on each call (the largest legal window), so the table
--      self-prunes regardless of which windows callers use.

CREATE OR REPLACE FUNCTION public.increment_rate_limit(p_key text, p_window_ms bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count integer;
begin
  if p_key is null
     or p_key !~ '^[A-Za-z0-9._:/@-]{1,200}$'
     or p_window_ms is null
     or p_window_ms < 1000
     or p_window_ms > 86400000
  then
    raise exception 'invalid rate limit parameters';
  end if;

  insert into public.rate_limit_counters as rlc (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    count = case
      when rlc.window_start < now() - make_interval(secs => p_window_ms / 1000.0)
        then 1
      else rlc.count + 1
    end,
    window_start = case
      when rlc.window_start < now() - make_interval(secs => p_window_ms / 1000.0)
        then now()
      else rlc.window_start
    end,
    updated_at = now()
  returning count into v_count;

  return v_count;
end $function$;

CREATE OR REPLACE FUNCTION public.advance_rate_limit_window(p_key text, p_window_ms bigint)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from public.rate_limit_counters
  where window_start < now() - interval '24 hours';
$function$;
