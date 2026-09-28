import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";
import { requireCsrfOrBearer } from "@/lib/security/csrf";

type ReviewDecision = "approved" | "rejected" | "returned";

type QueueRecord = {
  id: number;
  review_status: string | null;
  source_id: number | null;
  entity_type: string | null;
};

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

    const queueId =
      body.queueId !== undefined
        ? Number(body.queueId)
        : null;

    const sourceId =
      body.sourceId !== undefined &&
      body.sourceId !== null
        ? Number(body.sourceId)
        : null;

    const decision = body.decision as ReviewDecision;

    const notes =
      typeof body.notes === "string"
        ? body.notes.trim()
        : null;

    if (
      !["approved", "rejected", "returned"].includes(
        decision,
      )
    ) {
      return NextResponse.json(
        { error: "Invalid review decision." },
        { status: 400 },
      );
    }

    /*
     * ---------------------------------------------------------
     * SINGLE RECORD REVIEW
     * ---------------------------------------------------------
     */

    if (queueId !== null) {
      if (!Number.isInteger(queueId) || queueId <= 0) {
        return NextResponse.json(
          { error: "A valid queue ID is required." },
          { status: 400 },
        );
      }

      const { data: queueRecord, error: queueError } =
        await supabase
          .from("ingestion_queue")
          .select(
            "id, review_status, source_id, entity_type",
          )
          .eq("id", queueId)
          .maybeSingle<QueueRecord>();

      if (queueError) {
        return NextResponse.json(
          { error: queueError.message },
          { status: 500 },
        );
      }

      if (!queueRecord) {
        return NextResponse.json(
          {
            error: "Ingestion record not found.",
          },
          { status: 404 },
        );
      }

      const { error: reviewError } =
        await supabase
          .from("ingestion_reviews")
          .insert({
            queue_id: queueId,
            reviewer_id: user.id,
            decision,
            notes,
            source_id: queueRecord.source_id,
          });

      if (reviewError) {
        return NextResponse.json(
          { error: reviewError.message },
          { status: 500 },
        );
      }

      const { error: updateError } =
        await supabase
          .from("ingestion_queue")
          .update({
            review_status: decision,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            review_notes: notes,
          })
          .eq("id", queueId);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        );
      }

      /* Approved conflict records are materialised into the live
       * conflicts/conflict_parties tables (see 20261002 migration) so the
       * atlas and country profiles pick them up. Best-effort: the review
       * stamp above is the source of truth even if materialisation fails. */
      let materialised = 0;
      if (decision === "approved" && queueRecord.entity_type === "conflict") {
        const { data: materialisedCount, error: materialiseError } =
          await supabase.rpc("materialise_conflicts", {
            p_queue_ids: [queueId],
          });
        if (materialiseError) {
          console.error("[ingestion-review] materialise failed:", materialiseError.message);
        } else {
          materialised = Number(materialisedCount ?? 0);
        }
      }

      return NextResponse.json({
        success: true,
        queueId,
        decision,
        approvedCount:
          decision === "approved" ? 1 : 0,
        materialised,
      });
    }

    /*
     * ---------------------------------------------------------
     * SOURCE-WIDE REVIEW
     * ---------------------------------------------------------
     */

    if (sourceId !== null) {
      if (!Number.isInteger(sourceId) || sourceId <= 0) {
        return NextResponse.json(
          { error: "A valid source ID is required." },
          { status: 400 },
        );
      }

      /*
       * Only approve records which are currently pending.
       *
       * This deliberately does not overwrite records that have
       * already been approved, rejected or returned.
       */
      const { data: pendingRows, error: pendingError } =
        await supabase
          .from("ingestion_queue")
          .select(
            `
              id,
              review_status,
              source_id,
              entity_type,
              entity_id,
              title,
              source_url,
              published_at,
              retrieved_at,
              verification_status,
              data_confidence,
              confidence_score,
              created_at,
              sources (
                id,
                title,
                publisher
              )
            `,
          )
          .eq("source_id", sourceId)
          .eq("review_status", "pending");

      if (pendingError) {
        return NextResponse.json(
          { error: pendingError.message },
          { status: 500 },
        );
      }

      const rows =
        (pendingRows ?? []) as QueueRecord[];

      if (rows.length === 0) {
        return NextResponse.json({
          success: true,
          sourceId,
          decision,
          approvedCount: 0,
          message:
            "There are no pending entries from this source.",
        });
      }

      const queueIds = rows.map((row) => row.id);

      /*
       * Record an individual review entry for every queue record.
       * This preserves a complete audit trail.
       */
      const reviewRows = rows.map((row) => ({
        queue_id: row.id,
        reviewer_id: user.id,
        decision,
        notes,
        source_id: sourceId,
      }));

      const { error: reviewError } =
        await supabase
          .from("ingestion_reviews")
          .insert(reviewRows);

      if (reviewError) {
        return NextResponse.json(
          {
            error: reviewError.message,
          },
          { status: 500 },
        );
      }

      const { error: updateError } =
        await supabase
          .from("ingestion_queue")
          .update({
            review_status: decision,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            review_notes: notes,
          })
          .eq("source_id", sourceId)
          .eq("review_status", "pending");

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        );
      }

      /* Bulk approve of conflicts materialises them too (best-effort). */
      let materialised = 0;
      if (decision === "approved") {
        const conflictIds = rows
          .filter((row) => row.entity_type === "conflict")
          .map((row) => row.id);
        if (conflictIds.length > 0) {
          const { data: materialisedCount, error: materialiseError } =
            await supabase.rpc("materialise_conflicts", {
              p_queue_ids: conflictIds,
            });
          if (materialiseError) {
            console.error("[ingestion-review] bulk materialise failed:", materialiseError.message);
          } else {
            materialised = Number(materialisedCount ?? 0);
          }
        }
      }

      return NextResponse.json({
        success: true,
        sourceId,
        decision,
        approvedCount:
          decision === "approved"
            ? queueIds.length
            : 0,
        processedCount: queueIds.length,
        materialised,
      });
    }

    return NextResponse.json(
      {
        error:
          "Provide either queueId or sourceId.",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error(
      "Ingestion review error:",
      error,
    );

    return NextResponse.json(
      {
        error: "Invalid review request.",
      },
      { status: 400 },
    );
  }
}