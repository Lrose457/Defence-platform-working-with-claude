import { createClient } from "@/lib/supabase/server";

export async function getChangeEvidence(
  changeId: number,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("intelligence_evidence")
    .select(
      `
        id,
        change_id,
        source_id,
        evidence_type,
        evidence_title,
        evidence_url,
        evidence_excerpt,
        evidence_date,
        publisher,
        confidence,
        corroboration_status,
        analyst_notes,
        created_at
      `,
    )
    .eq("change_id", changeId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    return {
      evidence: [],
      error,
    };
  }

  return {
    evidence: data ?? [],
    error: null,
  };
}