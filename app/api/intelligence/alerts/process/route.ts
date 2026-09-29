import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";
import { requireCsrfOrBearer } from "@/lib/security/csrf";

function importanceRank(value: string | null) {
  switch ((value || "").toLowerCase()) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

export async function POST(request: Request) {
  /*
   * This endpoint is typically triggered by a cron job, not by
   * browser navigation. Require a valid CSRF token (browser) or
   * bearer token (server-to-server).
   */
  const csrfCheck = requireCsrfOrBearer(request);
  if (csrfCheck) return csrfCheck;

  const auth = await requireAdmin();

  if (!auth.ok) {
    return auth.response;
  }

  const { supabase, user } = auth;

  const { data: alerts, error: alertsError } =
    await supabase
      .from("user_alerts")
      .select("*")
      .eq("user_id", user.id)
      .eq("enabled", true);

  if (alertsError) {
    return NextResponse.json(
      { error: alertsError.message },
      { status: 500 },
    );
  }

  if (!alerts?.length) {
    return NextResponse.json({
      success: true,
      queued: 0,
    });
  }

  const { data: changes, error: changesError } =
    await supabase
      .from("data_changes")
      .select("*")
      .eq("intelligence_eligible", true)
      .order("changed_at", {
        ascending: false,
      })
      .limit(100);

  if (changesError) {
    return NextResponse.json(
      { error: changesError.message },
      { status: 500 },
    );
  }

  let queued = 0;

  for (const alert of alerts) {
    for (const change of changes || []) {
      if (
        importanceRank(change.importance) <
        importanceRank(alert.importance_threshold)
      ) {
        continue;
      }

      if (
        alert.entity_type &&
        change.entity_type !== alert.entity_type
      ) {
        continue;
      }

      if (
        alert.entity_id &&
        Number(change.entity_id) !==
          Number(alert.entity_id)
      ) {
        continue;
      }

      const { data: existing } = await supabase
        .from("alert_delivery_queue")
        .select("id")
        .eq("alert_id", alert.id)
        .eq("change_id", change.id)
        .maybeSingle();

      if (existing) {
        continue;
      }

      const title =
        change.summary ||
        `${change.entity_type} intelligence update`;

      const message =
        change.assessment ||
        change.reason ||
        "A tracked intelligence change has been recorded.";

      const { error } = await supabase
        .from("alert_delivery_queue")
        .insert({
          alert_id: alert.id,
          change_id: change.id,
          delivery_type: "in_app",
          status: "pending",
          title,
          message,
        });

      if (!error) {
        queued++;
      }
    }
  }

  return NextResponse.json({
    success: true,
    queued,
  });
}