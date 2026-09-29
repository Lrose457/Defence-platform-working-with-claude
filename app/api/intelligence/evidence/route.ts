import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";
import { requireCsrfOrBearer } from "@/lib/security/csrf";

export async function POST(request: Request) {
  const csrfCheck = requireCsrfOrBearer(request);
  if (csrfCheck) return csrfCheck;

  const auth = await requireAdmin();

  if (!auth.ok) {
    return auth.response;
  }

  const { supabase, user } = auth;

  const body = await request.json();

  const changeId = Number(body.change_id);

  if (!Number.isFinite(changeId)) {
    return NextResponse.json(
      {
        error: "Invalid change_id",
      },
      {
        status: 400,
      },
    );
  }

  const evidenceType =
    typeof body.evidence_type === "string"
      ? body.evidence_type
      : "primary";

  const confidence =
    typeof body.confidence === "string"
      ? body.confidence
      : null;

  const corroborationStatus =
    typeof body.corroboration_status === "string"
      ? body.corroboration_status
      : "single_source";

  const { data, error } = await supabase
    .from("intelligence_evidence")
    .insert({
      change_id: changeId,
      source_id:
        body.source_id != null
          ? Number(body.source_id)
          : null,
      evidence_type: evidenceType,
      evidence_title:
        typeof body.evidence_title === "string"
          ? body.evidence_title
          : null,
      evidence_url:
        typeof body.evidence_url === "string"
          ? body.evidence_url
          : null,
      evidence_excerpt:
        typeof body.evidence_excerpt === "string"
          ? body.evidence_excerpt
          : null,
      evidence_date:
        typeof body.evidence_date === "string"
          ? body.evidence_date
          : null,
      publisher:
        typeof body.publisher === "string"
          ? body.publisher
          : null,
      confidence,
      corroboration_status: corroborationStatus,
      analyst_notes:
        typeof body.analyst_notes === "string"
          ? body.analyst_notes
          : null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    evidence: data,
  });
}