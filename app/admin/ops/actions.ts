"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/auth/adminAccess";

/**
 * Update one pipeline freshness budget from the /admin/ops editor.
 * Re-gates on the analyst role server-side (never trust the render) and
 * clamps to the same 1–8760h range the DB constraint enforces.
 */
export async function updateFreshnessBudget(
  dataset: string,
  budgetHours: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getAdminAccess();
  if (!access.ok) {
    return { ok: false, error: "Analyst access required" };
  }

  if (typeof dataset !== "string" || !/^[a-z_]{1,64}$/.test(dataset)) {
    return { ok: false, error: "Invalid dataset name" };
  }

  const hours = Math.round(Number(budgetHours));
  if (!Number.isFinite(hours) || hours < 1 || hours > 8760) {
    return { ok: false, error: "Budget must be 1–8760 hours" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("ops_freshness_budgets")
    .upsert(
      { dataset, budget_hours: hours },
      { onConflict: "dataset" },
    );

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/ops");
  return { ok: true };
}
