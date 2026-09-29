import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyExportLimit, currentUsageMonth } from "@/lib/exportEntitlements";

export default async function ExportUsagePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="space-y-5">
        <h1 className="text-3xl font-bold text-white">
          Export Usage
        </h1>

        <p className="text-slate-400">
          Sign in to view your export usage.
        </p>

        <Link
          href="/account/login"
          className="text-sky-400 hover:underline"
        >
          Sign in →
        </Link>
      </div>
    );
  }

  const month = currentUsageMonth();

  const { data: usage } = await supabase
    .from("export_usage_monthly")
    .select("export_count")
    .eq("user_id", user.id)
    .eq("usage_month", month)
    .maybeSingle();

  const limit = await getMonthlyExportLimit(supabase, user.id);

  const used = usage?.export_count || 0;

  const percentage =
    limit.monthlyExports > 0
      ? Math.min(
          (used / limit.monthlyExports) * 100,
          100,
        )
      : 0;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-sky-400">
          Account
        </p>

        <h1 className="text-4xl font-bold text-white">
          Export Usage
        </h1>

        <p className="text-slate-400">
          Your export allowance for the current billing
          month.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">
              Exports used
            </p>

            <p className="mt-2 text-4xl font-bold text-white">
              {used}
              <span className="text-lg font-normal text-slate-500">
                {" "}
                / {limit.monthlyExports}
              </span>
            </p>
          </div>

          <p className="text-sm text-slate-500">
            Month: {month}
          </p>
        </div>

        <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-sky-400"
            style={{
              width: `${percentage}%`,
            }}
          />
        </div>

        <p className="mt-4 text-sm text-slate-400">
          {Math.max(
            limit.monthlyExports - used,
            0,
          )}{" "}
          exports remaining this month.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-xl font-semibold text-white">
          Need more exports?
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Review the available plans and their export
          allowances.
        </p>

        <Link
          href="/account/billing"
          className="mt-5 inline-flex rounded-lg bg-sky-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-sky-300"
        >
          View Plans & Billing
        </Link>
      </section>
    </div>
  );
}