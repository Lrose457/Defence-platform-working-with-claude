import { NextResponse } from "next/server";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import { rateLimit, requestKey } from "@/lib/security/rateLimit";
import { rateLimitDb } from "@/lib/security/rateLimitDb";
import { sanitizeText } from "@/lib/security/sanitize";
import { requireCsrfOrBearer } from "@/lib/security/csrf";

const allowedEntities = new Set([
  "country",
  "company",
  "equipment",
  "programme",
  "contract",
  "budget",
]);

const allowedConfidence = new Set([
  "High",
  "Medium",
  "Low",
]);

const allowedImportance = new Set([
  "high",
  "normal",
  "low",
]);

export async function POST(request: Request) {
  try {
    const csrfCheck = requireCsrfOrBearer(request);
    if (csrfCheck) return csrfCheck;

    const limit = rateLimit(`intelligence:${requestKey(request)}`, 20);
    if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

    const supabase = await createClient();

    /* Distributed rate limit across serverless instances. */
    const dbLimit = await rateLimitDb(supabase, `intelligence:${requestKey(request)}`, 20);
    if (!dbLimit.allowed) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    const auth = await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const { supabase: adminSupabase } = auth;

    const formData = await request.formData();

    const entityValue = String(formData.get("entity_id") ?? "");
    const entityType = String(formData.get("entity_type") ?? "");

    const [entityTypeFromValue, entityIdString] = entityValue.split(":");

    if (
      !allowedEntities.has(entityType) ||
      entityTypeFromValue !== entityType ||
      !entityIdString
    ) {
      return NextResponse.json(
        { error: "Invalid entity." },
        { status: 400 }
      );
    }

    const entityId = Number(entityIdString);

    if (!Number.isInteger(entityId) || entityId <= 0) {
      return NextResponse.json(
        { error: "Invalid entity ID." },
        { status: 400 }
      );
    }

    const fieldName = sanitizeText(formData.get("field_name"), 120).trim();
    const oldValue = sanitizeText(formData.get("old_value"), 4_000).trim();
    const newValue = sanitizeText(formData.get("new_value"), 4_000).trim();
    const changeDate = sanitizeText(formData.get("change_date"), 40).trim();
    const reason = sanitizeText(formData.get("reason"), 4_000).trim();
    const notes = sanitizeText(formData.get("notes"), 4_000).trim();
    const sourceId = Number(formData.get("source_id"));
    const confidence = String(
      formData.get("data_confidence") ?? "Medium"
    );
    const importance = String(
      formData.get("importance") ?? "normal"
    );
    const entryMethod = sanitizeText(formData.get("entry_method") ?? "Analyst entry", 100);

    if (
      !fieldName ||
      !changeDate ||
      !reason ||
      !Number.isInteger(sourceId) ||
      sourceId <= 0
    ) {
      return NextResponse.json(
        { error: "Required fields are missing." },
        { status: 400 }
      );
    }

    if (!allowedConfidence.has(confidence)) {
      return NextResponse.json(
        { error: "Invalid confidence value." },
        { status: 400 }
      );
    }

    if (!allowedImportance.has(importance)) {
      return NextResponse.json(
        { error: "Invalid importance value." },
        { status: 400 }
      );
    }

    const { data: source, error: sourceError } = await adminSupabase
      .from("sources")
      .select("id")
      .eq("id", sourceId)
      .maybeSingle();

    if (sourceError) {
      return NextResponse.json(
        { error: sourceError.message },
        { status: 500 }
      );
    }

    if (!source) {
      return NextResponse.json(
        { error: "Selected source does not exist." },
        { status: 400 }
      );
    }

    const tableMap: Record<string, string> = {
      country: "countries",
      company: "companies",
      equipment: "equipment",
      programme: "programmes",
      contract: "contracts",
      budget: "budgets",
    };

    const tableName = tableMap[entityType];

    const { data: entity, error: entityError } = await adminSupabase
      .from(tableName)
      .select("id")
      .eq("id", entityId)
      .maybeSingle();

    if (entityError) {
      return NextResponse.json(
        { error: entityError.message },
        { status: 500 }
      );
    }

    if (!entity) {
      return NextResponse.json(
        { error: "Selected entity does not exist." },
        { status: 400 }
      );
    }

    const { error: insertError } = await adminSupabase
      .from("data_changes")
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        field_name: fieldName,
        old_value: oldValue || null,
        new_value: newValue || null,
        change_date: changeDate,
        reason,
        source_id: sourceId,
        data_confidence: confidence,
        table_name: tableName,
        record_id: entityId,
        change_type: "Intelligence update",
        changed_at: new Date().toISOString(),
        notes: notes || null,
        importance,
        intelligence_eligible: true,
        entry_method: entryMethod,
      });

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.redirect(
      new URL("/changes", request.url),
      303
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to record intelligence.",
      },
      { status: 500 }
    );
  }
}