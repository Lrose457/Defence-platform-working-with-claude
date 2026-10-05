import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/security/rateLimit";

/**
 * Database-backed rate limiter that works across multiple serverless
 * instances.
 *
 * The in-memory rate limiter (`rateLimit`) is per-instance and resets on
 * restart; `rateLimitDb` uses a lightweight counter table to enforce
 * limits globally, so it is the primary limiter for API routes. The
 * in-memory limiter takes over only when the database is unreachable.
 */

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
  /** True when the database could not answer and a fallback decided. */
  dbError?: boolean;
};

type RateLimitOptions = {
  /**
   * When true, a database error blocks the request (used for sensitive
   * endpoints that need the DB anyway). When false (default), a database
   * error allows the request and the in-memory limiter still applies.
   *
   * Either way, a missing RPC (PGRST202 — migrations not yet applied on a
   * fresh environment) fails OPEN: the in-memory limiter still guards the
   * endpoint, and blocking logins over schema drift would brick the app.
   */
  failClosed?: boolean;
};

/**
 * Increment the counter for `key` within `windowMs` and return whether
 * the request is within the allowed limit.
 *
 * Uses an atomic upsert on a dedicated counter row. The caller is
 * responsible for passing a server-side (anon-key) client so RLS
 * policies on the table do not interfere.
 */
export async function rateLimitDb(
  supabase: SupabaseClient,
  key: string,
  limit = 30,
  windowMs = 60_000,
  options: RateLimitOptions = {},
): Promise<RateLimitResult> {
  /*
   * Decrement expired counters atomically. Any row whose window_start
   * is older than the current window is reset to zero.
   */
  await supabase.rpc("advance_rate_limit_window", {
    p_key: key,
    p_window_ms: windowMs,
  });

  /*
   * Increment the counter for this key in a single atomic statement.
   * We insert the row if it doesn't exist, otherwise increment.
   */
  const { data: counter, error } = await supabase.rpc(
    "increment_rate_limit",
    {
      p_key: key,
      p_window_ms: windowMs,
    },
  );

  if (error) {
    if (options.failClosed && error.code !== "PGRST202") {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil(windowMs / 1000),
        dbError: true,
      };
    }

    /*
     * If the database is unavailable or the RPC doesn't exist yet,
     * allow the request; the caller (see `dbRateLimit`) falls back to
     * the in-memory limiter for per-instance protection.
     */
    return { allowed: true, remaining: limit - 1, retryAfter: 0, dbError: true };
  }

  const count = counter ?? 0;

  if (count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil(windowMs / 1000),
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - count),
    retryAfter: 0,
  };
}

/*
 * Cookieless anon-key client for rate-limit counters. The RPCs are
 * SECURITY DEFINER and callable by anon, so no session is needed; the
 * client is shared across calls (and hot-reloads) to avoid re-creating
 * it per request.
 */
let anonClient: SupabaseClient | null = null;

function getAnonClient(): SupabaseClient {
  if (!anonClient) {
    anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return anonClient;
}

/**
 * DB-primary rate limit for API routes.
 *
 * Consults the shared counter table first (limits hold across instances
 * and restarts); only when the database cannot answer — outage, or the
 * RPCs missing on a fresh environment — does the per-instance in-memory
 * limiter decide instead. Callers that pass `failClosed` keep blocking
 * on database errors (sensitive endpoints) rather than degrading.
 */
export async function dbRateLimit(
  key: string,
  limit = 30,
  windowMs = 60_000,
  options: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const result = await rateLimitDb(getAnonClient(), key, limit, windowMs, options);
  if (!result.dbError || options.failClosed) return result;
  return rateLimit(key, limit, windowMs);
}
