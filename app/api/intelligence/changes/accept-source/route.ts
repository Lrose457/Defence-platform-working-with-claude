import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/supabase/server";
import { requireCsrfOrBearer } from "@/lib/security/csrf";

export async function POST(request: Request) {
  try {
    const csrfCheck = requireCsrfOrBearer(request);
    if (csrfCheck) return csrfCheck;

    const auth = await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const { supabase, user } = auth;
    const body = await request.json();
    const changeId = Number(body?.changeId);

    if (!Number.isInteger(changeId) || changeId <= 0) {
      return NextResponse.json(
        { error: "A valid change ID is required." },
        { status: 400 },
      );
    }

    /*
     * First find the selected intelligence change and its source.
     * We deliberately derive the source from the database rather than
     * trusting a source ID supplied by the browser.
     */
    const { data: selectedChange, error: selectedChangeError } =
      await supabase
        .from("data_changes")
        .select("id, source_id, intelligence_eligible, reviewed")
        .eq("id", changeId)
        .maybeSingle();

    if (selectedChangeError) {
      return NextResponse.json(
        { error: selectedChangeError.message },
        { status: 500 },
      );
    }

    if (!selectedChange) {
      return NextResponse.json(
        { error: "Intelligence change not found." },
        { status: 404 },
      );
    }

    if (!selectedChange.intelligence_eligible) {
      return NextResponse.json(
        { error: "This change is not eligible for intelligence review." },
        { status: 400 },
      );
    }

    if (selectedChange.source_id == null) {
      return NextResponse.json(
        {
          error:
            "This change does not have a source, so source-wide acceptance is unavailable.",
        },
        { status: 400 },
      );
    }

    /*
     * Only accept currently unreviewed, intelligence-eligible changes.
     *
     * The source ID comes from the selected database record.
     */
    const reviewedAt = new Date().toISOString();

    const { data: acceptedChanges, error: updateError } = await supabase
      .from("data_changes")
      .update({
        reviewed: true,
        reviewed_at: reviewedAt,
        reviewed_by: user.id,
      })
      .eq("source_id", selectedChange.source_id)
      .eq("intelligence_eligible", true)
      .or("reviewed.is.null,reviewed.eq.false")
      .select("id");

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      );
    }

    const acceptedCount = acceptedChanges?.length ?? 0;

    return NextResponse.json({
      success: true,
      sourceId: selectedChange.source_id,
      acceptedCount,
    });
  } catch (error) {
    console.error("Accept-source error:", error);

    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 },
    );
  }
}