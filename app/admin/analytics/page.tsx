import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess, AdminGate } from "@/lib/auth/adminAccess";
import { formatNumber } from "@/lib/format";

export const metadata = { title: "Audience analytics — Admin" };

type SurveyRow = {
  role: string;
  benefit: string;
  organisation_type: string | null;
  created_at: string;
};

export default async function AdminAnalyticsPage() {
  const access = await getAdminAccess();
  if (!access.ok) {
    return <AdminGate reason={access.reason} redirectTo="/admin/analytics" />;
  }

  const supabase = await createClient();

  const [{ data: responses }, { data: searchAgg }] = await Promise.all([
    supabase
      .from("user_survey_responses")
      .select("role, benefit, organisation_type, created_at")
      .order("created_at", { ascending: false })
      .limit(1_000),
    supabase.rpc("search_log_daily_agg", { p_days: 30 }),
  ]);

  const byRole = new Map<string, number>();
  const byBenefit = new Map<string, number>();
  for (const r of (responses ?? []) as SurveyRow[]) {
    byRole.set(r.role, (byRole.get(r.role) ?? 0) + 1);
    byBenefit.set(r.benefit, (byBenefit.get(r.benefit) ?? 0) + 1);
  }

  const searchRows = (searchAgg ?? []) as { day: string; searches: number; distinct_sessions: number }[];
  const totalSearches = searchRows.reduce((s, r) => s + Number(r.searches), 0);
  const maxDay = Math.max(...searchRows.map((r) => Number(r.searches)), 1);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-7">
      <div>
        <Link href="/admin" className="text-xs text-slate-500 hover:text-cyan-300">← Admin</Link>
        <h1 className="mt-3 text-2xl font-semibold">Audience analytics</h1>
        <p className="mt-1 text-sm text-slate-400">
          Aggregates only — survey responses are anonymous and search logs are
          salted hashes. No per-user views exist by design.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase text-slate-500">Survey responses</p>
          <p className="mt-1 text-2xl font-semibold">{(responses ?? []).length}</p>
        </div>
        <div className="rounded border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase text-slate-500">Searches (30d)</p>
          <p className="mt-1 text-2xl font-semibold">{formatNumber(totalSearches)}</p>
        </div>
        <div className="rounded border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase text-slate-500">Active anonymous sessions (30d)</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatNumber(Math.max(...searchRows.map((r) => Number(r.distinct_sessions)), 0))}
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-medium text-slate-200">Who uses the platform</h2>
          {byRole.size === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No survey responses yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {[...byRole.entries()].sort(([, a], [, b]) => b - a).map(([role, n]) => (
                <li key={role} className="flex items-center gap-2 text-xs">
                  <span className="w-40 shrink-0 text-slate-400">{role}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded bg-slate-800">
                    <div
                      className="h-full rounded bg-cyan-600"
                      style={{ width: `${(n / Math.max(...byRole.values(), 1)) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-slate-500">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-medium text-slate-200">What they get from it</h2>
          {byBenefit.size === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No survey responses yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {[...byBenefit.entries()].sort(([, a], [, b]) => b - a).map(([benefit, n]) => (
                <li key={benefit} className="flex items-center gap-2 text-xs">
                  <span className="w-40 shrink-0 text-slate-400">{benefit}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded bg-slate-800">
                    <div
                      className="h-full rounded bg-cyan-600"
                      style={{ width: `${(n / Math.max(...byBenefit.values(), 1)) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-slate-500">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-sm font-medium text-slate-200">Search volume (30 days)</h2>
        {searchRows.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            Search aggregate view not deployed yet (needs the{" "}
            <span className="font-mono">search_log_daily_agg</span> RPC).
          </p>
        ) : (
          <div className="mt-4 flex h-24 items-end gap-1">
            {searchRows.map((r) => (
              <div
                key={r.day}
                className="flex-1 rounded-t bg-cyan-700"
                style={{ height: `${Math.max(3, (Number(r.searches) / maxDay) * 100)}%` }}
                title={`${r.day}: ${r.searches} searches`}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
