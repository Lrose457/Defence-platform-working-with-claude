import type { SupabaseClient } from "@supabase/supabase-js";

type PlanLimit = {
  monthlyExports: number;
};

const DEFAULT_LIMIT = 3;

export async function getMonthlyExportLimit(
  supabase: SupabaseClient,
  userId: string,
): Promise<PlanLimit> {
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!subscription) {
    return {
      monthlyExports: DEFAULT_LIMIT,
    };
  }

  const planName =
    subscription.plan_name ||
    subscription.plan ||
    "Free";

  const limits: Record<string, number> = {
    Free: 3,
    Analyst: 50,
    Organisation: 500,
  };

  return {
    monthlyExports:
      limits[planName] ?? DEFAULT_LIMIT,
  };
}

export function currentUsageMonth() {
  const now = new Date();

  return `${now.getUTCFullYear()}-${String(
    now.getUTCMonth() + 1,
  ).padStart(2, "0")}-01`;
}