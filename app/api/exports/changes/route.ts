import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { getMonthlyExportLimit, currentUsageMonth } from "@/lib/exportEntitlements";
import { FCRA_DISCLAIMER } from "@/lib/security/privacy";

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);

  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const auth = await requireUser();

  if (!auth.ok) {
    return auth.response;
  }

  const { supabase, user } = auth;

  /*
   * Enforce per-user monthly export limits based on subscription plan.
   */
  const limit = await getMonthlyExportLimit(supabase, user.id);
  const usageMonth = currentUsageMonth();

  const { data: usage } = await supabase
    .from("export_usage_monthly")
    .select("export_count")
    .eq("user_id", user.id)
    .eq("usage_month", usageMonth)
    .maybeSingle();

  const used = usage?.export_count || 0;

  if (used >= limit.monthlyExports) {
    return NextResponse.json(
      {
        error: "Monthly export limit reached.",
        used,
        limit: limit.monthlyExports,
      },
      { status: 429 },
    );
  }

  const { data, error } = await supabase
    .from("data_changes")
    .select(`
      id,
      entity_type,
      entity_id,
      field_name,
      old_value,
      new_value,
      change_type,
      change_date,
      changed_at,
      importance,
      severity,
      data_confidence,
      summary,
      assessment
    `)
    .eq("intelligence_eligible", true)
    .neq("field_name", "record_created")
    .neq("change_type", "Initial record")
    .order("changed_at", { ascending: false })
    .limit(25000);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  const headers = [
    "id",
    "entity_type",
    "entity_id",
    "field_name",
    "old_value",
    "new_value",
    "change_type",
    "change_date",
    "changed_at",
    "importance",
    "severity",
    "data_confidence",
    "summary",
    "assessment",
  ];

  const lines = [
    headers.map(csvEscape).join(","),
    ...(data ?? []).map((row) =>
      headers
        .map((header) =>
          csvEscape(row[header as keyof typeof row]),
        )
        .join(","),
    ),
  ];

  /*
   * Increment the user's monthly export counter before sending the
   * response.  A failed counter update should not prevent the export
   * from being delivered, but a successful export must still be counted.
   */
  try {
    await supabase
      .from("export_usage_monthly")
      .upsert({
        user_id: user.id,
        usage_month: usageMonth,
        export_count: used + 1,
        plan_limit: limit.monthlyExports,
      }, { onConflict: "user_id,usage_month" });
  } catch {
    /* swallow — the export is still being sent */
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="defence-intelligence-changes.csv"',
      "X-FCRA-Disclaimer": FCRA_DISCLAIMER,
    },
  });
}