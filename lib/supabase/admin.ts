import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client with the service_role key.
 *
 * The publishable anon client honours RLS, which is correct everywhere
 * user-facing — but trusted server-side jobs (Stripe webhook reconciliation,
 * GDPR request processing) must write rows the requesting browser can
 * never see (subscriptions, platform_roles, privacy_requests). This client
 * bypasses RLS and must NEVER be imported from a client component or
 * expose its key through NEXT_PUBLIC_*.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured — admin database access is unavailable.",
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
