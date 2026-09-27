import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Database-backed rate limiter that works across multiple serverless
 * instances.
 *
 * The in-memory rate limiter (`rateLimit`) provides a fast first check
 * within a single instance but cannot coordinate across instances.
 * `rateLimitDb` uses a lightweight counter table to enforce limits
 * globally, so it is immune to the multi-instance bypass.
 */

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
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
      };
    }

    /*
     * If the database is unavailable or the RPC doesn't exist yet,
     * fall back to allowing the request rather than blocking all
     * traffic. The in-memory limiter still provides per-instance
     * protection.
     */
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
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
