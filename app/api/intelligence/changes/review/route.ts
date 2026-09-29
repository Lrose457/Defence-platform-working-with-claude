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
        {
          error: "A valid change ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const { data: change, error: changeError } =
      await supabase
        .from("data_changes")
        .select(
          `
            id,
            source_id,
            intelligence_eligible,
            reviewed
          `,
        )
        .eq("id", changeId)
        .single();

    if (changeError || !change) {
      return NextResponse.json(
        {
          error:
            changeError?.message ||
            "Intelligence change not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (!change.intelligence_eligible) {
      return NextResponse.json(
        {
          error:
            "This change is not eligible for intelligence review.",
        },
        {
          status: 400,
        },
      );
    }

    if (change.reviewed) {
      return NextResponse.json({
        success: true,
        alreadyReviewed: true,
        changeId,
      });
    }

    const { error: updateError } =
      await supabase
        .from("data_changes")
        .update({
          reviewed: true,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("id", changeId);

    if (updateError) {
      console.error(
        "Intelligence review update failed:",
        updateError,
      );

      return NextResponse.json(
        {
          error: updateError.message,
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      alreadyReviewed: false,
      changeId,
      sourceId: change.source_id,
      reviewedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Intelligence review request failed:",
      error,
    );

    return NextResponse.json(
      {
        error: "Invalid review request.",
      },
      {
        status: 400,
      },
    );
  }
}