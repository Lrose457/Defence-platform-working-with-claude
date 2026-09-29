import { createClient } from "@/lib/supabase/server";
import { hashAnonymousSession } from "@/lib/security/privacy";

export async function log_search_query(
  session_token: string,
  target_query: string,
  result_count = 0,
) {
  if (!session_token || !target_query.trim()) return;

  const supabase = await createClient();
  const { error } = await supabase.from("anonymous_search_logs").insert({
    session_hash: hashAnonymousSession(session_token),
    query_hash: hashAnonymousSession(target_query.trim().toLowerCase()),
    result_count,
  });

  if (error) throw error;
}
