import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";
import { validateOutboundUrl } from "@/lib/security/ssrf";
import { sanitizeText, sanitizeUrl } from "@/lib/security/sanitize";
import { requireCsrfOrBearer } from "@/lib/security/csrf";

type IngestionPayload = {
  ingestion_source_id?: number | null;
  source_id?: number | null;
  external_id?: string | null;
  entity_type: string;
  entity_id?: number | null;
  operation?: string;
  title?: string | null;
  raw_payload?: unknown;
  normalised_payload?: unknown;
  source_url?: string | null;
  published_at?: string | null;
  retrieved_at?: string | null;
  verification_status?: string | null;
  data_confidence?: string | null;
  confidence_score?: number | null;
};

export async function POST(request: Request) {
  const csrfCheck = requireCsrfOrBearer(request);
  if (csrfCheck) return csrfCheck;

  const auth = await requireAdmin();

  if (!auth.ok) {
    return auth.response;
  }

  const { supabase } = auth;

  let body: IngestionPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  if (!body.entity_type) {
    return NextResponse.json(
      { error: "entity_type is required." },
      { status: 400 },
    );
  }

  const sourceUrl = body.source_url ? sanitizeUrl(body.source_url) : null;
  if (body.source_url && !sourceUrl) {
    return NextResponse.json({ error: "source_url must be a valid HTTP(S) URL." }, { status: 400 });
  }

  if (sourceUrl) {
    try {
      await validateOutboundUrl(sourceUrl);
    } catch {
      return NextResponse.json({ error: "source_url targets a restricted network." }, { status: 400 });
    }
  }

  const verificationStatus = body.verification_status
    ? sanitizeText(body.verification_status, 40).toLowerCase()
    : null;

  if (
    verificationStatus &&
    !["unverified", "needs_review", "verified", "rejected"].includes(verificationStatus)
  ) {
    return NextResponse.json({ error: "verification_status is invalid." }, { status: 400 });
  }

  let retrievedAt: string | null = null;
  if (body.retrieved_at) {
    const dateValue = new Date(body.retrieved_at);
    if (Number.isNaN(dateValue.getTime())) {
      return NextResponse.json({ error: "retrieved_at must be a valid ISO date string." }, { status: 400 });
    }
    retrievedAt = dateValue.toISOString();
  }

  const confidenceScore =
    typeof body.confidence_score === "number"
      ? Math.min(100, Math.max(0, body.confidence_score))
      : null;

  const { data, error } = await supabase
    .from("ingestion_queue")
    .insert({
      ingestion_source_id: body.ingestion_source_id ?? null,
      source_id: body.source_id ?? null,
      external_id: body.external_id ? sanitizeText(body.external_id, 200) : null,
      entity_type: sanitizeText(body.entity_type, 80),
      entity_id: body.entity_id ?? null,
      operation: body.operation ?? "review",
      title: body.title ? sanitizeText(body.title, 500) : null,
      raw_payload: body.raw_payload ?? null,
      normalised_payload: body.normalised_payload ?? null,
      source_url: sourceUrl,
      published_at: body.published_at ?? null,
      retrieved_at: retrievedAt,
      verification_status: verificationStatus,
      data_confidence: body.data_confidence ?? null,
      confidence_score: confidenceScore,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      success: true,
      record: data,
    },
    { status: 201 },
  );
}