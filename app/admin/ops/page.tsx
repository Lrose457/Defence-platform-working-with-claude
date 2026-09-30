import { getAdminAccess, AdminGate } from "@/lib/auth/adminAccess";
import { getOpsSnapshot, type CheckState } from "@/lib/ops/telemetry";

/**
 * /admin/ops — operator dashboard.
 *
 * Answers three questions at a glance:
 *   1. Is the TLE satellite feed fresh? (cache age + hourly agent's last run)
 *   2. Is the database reachable and populated?
 *   3. Are SSR payloads staying lean? (compressed /map transfer size)
 *
 * Server-rendered on demand; every input is a cheap local read.
 */

const stateStyle: Record<CheckState, { label: string; className: string }> = {
  ok: { label: "OK", className: "text-green-400 border-green-900 bg-green-950/40" },
  warn: { label: "Warn", className: "text-amber-400 border-amber-900 bg-amber-950/40" },
  fail: { label: "Fail", className: "text-red-400 border-red-900 bg-red-950/40" },
  unknown: { label: "Unknown", className: "text-slate-400 border-slate-700 bg-slate-900/60" },
};

function StateBadge({ state }: { state: CheckState }) {
  const style = stateStyle[state];
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${style.className}`}
    >
      {style.label}
    </span>
  );
}

export default async function OpsPage() {
  const access = await getAdminAccess();
  if (!access.ok) {
    return <AdminGate reason={access.reason} redirectTo="/admin/ops" />;
  }

  const ops = await getOpsSnapshot();

  return (
    <div className="w-full space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
          Platform
        </p>
        <h1 className="mt-2 text-4xl font-bold">Operations</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          Live health of the satellite feed, the database and server-rendered
          payload budgets. Read-only — every value is measured on request.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="intel-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
              TLE satellite cache
            </p>
            <StateBadge state={ops.tle.state} />
          </div>
          <p className="mt-3 text-3xl font-bold">
            {ops.tle.ageHours != null ? `${ops.tle.ageHours}h` : "—"}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            {ops.tle.cached
              ? `${ops.tle.count} elements · refreshed ${ops.tle.refreshedAt ?? "unknown"}`
              : "Cache empty — hit /api/satellites?refresh=1"}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Hourly agent:{" "}
            {ops.agent.lastRunAt ? (
              <>
                last ran{" "}
                {ops.agent.lastRunAt.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </>
            ) : (
              "no log found on this host"
            )}
          </p>
          {ops.agent.lastRun && (
            <p className="mt-1 truncate font-mono text-[11px] text-slate-600" title={ops.agent.lastRun}>
              {ops.agent.lastRun}
            </p>
          )}
        </div>

        <div className="intel-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
              Database
            </p>
            <StateBadge state={ops.db.state} />
          </div>
          <p className="mt-3 text-3xl font-bold">
            {ops.db.countries ?? "—"}
            <span className="ml-1 text-sm font-normal text-slate-500">countries</span>
          </p>
          <p className="mt-2 text-sm text-slate-400">
            {ops.db.conflicts ?? "—"} conflicts · {ops.db.installations ?? "—"} installations
          </p>
          {ops.db.error && (
            <p className="mt-3 text-xs text-red-400">{ops.db.error}</p>
          )}
        </div>

        <div className="intel-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
              /map SSR payload
            </p>
            <StateBadge state={ops.payload.state} />
          </div>
          <p className="mt-3 text-3xl font-bold">
            {ops.payload.mapKb != null ? `${ops.payload.mapKb} KB` : "—"}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            {ops.payload.ms != null ? `compressed transfer · ${ops.payload.ms} ms` : ops.payload.error}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Budget: 400 KB compressed (was 224 KB before the optimisation pass).
          </p>
        </div>
      </section>

      <section className="intel-surface p-5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
          Runbook
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-400">
          <li>
            <span className="text-slate-200">TLE cache stale or empty</span> —
            re-run <code className="font-mono text-xs">scripts/install-app-agent.sh</code>{" "}
            (warms the cache) or wait for the hourly refresh at :00.
          </li>
          <li>
            <span className="text-slate-200">Database fail</span> — check the
            anon key in <code className="font-mono text-xs">.env.local</code>{" "}
            is registered for this Supabase project, then rebuild (public env
            vars are baked at build time).
          </li>
          <li>
            <span className="text-slate-200">Payload over budget</span> — audit
            recent server components for unbounded{" "}
            <code className="font-mono text-xs">select(&quot;*&quot;)</code> fetches
            or heavy client bundles.
          </li>
        </ul>
      </section>
    </div>
  );
}
