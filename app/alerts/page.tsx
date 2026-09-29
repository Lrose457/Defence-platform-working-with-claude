import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function hrefFor(type: string | null, id: number | null) {
  if (!type || id == null) return null;

  const routes: Record<string, string> = {
    country: "countries",
    company: "companies",
    equipment: "equipment",
    programme: "programmes",
    contract: "contracts",
  };

  return routes[type] ? `/${routes[type]}/${id}` : null;
}

export default async function AlertsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">
          Alerts
        </h1>

        <p className="text-sm text-slate-400">
          Sign in to manage intelligence alerts.
        </p>

        <Link
          href="/account/login"
          className="inline-flex rounded-md border border-sky-700 bg-sky-950 px-4 py-2 text-sm text-sky-300"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const { data: alerts } = await supabase
    .from("user_alerts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const activeAlerts = (alerts ?? []).filter(
    (alert) => alert.enabled,
  );

  const matchingChanges =
    activeAlerts.length > 0
      ? (
          await supabase
            .from("data_changes")
            .select(
              "id, entity_type, entity_id, field_name, old_value, new_value, change_type, importance, severity, summary, changed_at",
            )
            .eq("intelligence_eligible", true)
            .order("changed_at", { ascending: false })
            .limit(250)
        ).data ?? []
      : [];

  const matches = matchingChanges.filter((change) =>
    activeAlerts.some((alert) => {
      if (
        alert.entity_type !== change.entity_type ||
        alert.entity_id !== change.entity_id
      ) {
        return false;
      }

      const threshold = alert.importance_threshold ?? "medium";

      const rank: Record<string, number> = {
        low: 1,
        medium: 2,
        high: 3,
      };

      return (
        (rank[change.importance ?? "medium"] ?? 2) >=
        (rank[threshold] ?? 2)
      );
    }),
  );

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">
          Intelligence
        </p>

        <h1 className="mt-2 text-3xl font-semibold">
          Alerts
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Monitor records for new intelligence changes that meet your
          importance thresholds.
        </p>
      </header>

      <section className="intel-metrics sm:grid-cols-3">
        <div className="intel-metric">
          <p className="intel-metric-label">
            Alerts
          </p>
          <p className="intel-metric-value">
            {(alerts ?? []).length}
          </p>
        </div>

        <div className="intel-metric">
          <p className="intel-metric-label">
            Active
          </p>
          <p className="intel-metric-value">
            {activeAlerts.length}
          </p>
        </div>

        <div className="intel-metric">
          <p className="intel-metric-label">
            Current matches
          </p>
          <p className="intel-metric-value">
            {matches.length}
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">
          Current matches
        </h2>

        <div className="mt-4 space-y-3">
          {matches.length === 0 ? (
            <div className="intel-empty-state">
              <p>
                No current changes match your active alerts.
              </p>
            </div>
          ) : (
            matches.map((change) => {
              const href = hrefFor(
                change.entity_type,
                change.entity_id,
              );

              return (
                <article
                  key={change.id}
                  className="intel-panel-body intel-surface"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      {href ? (
                        <Link
                          href={href}
                          className="font-medium text-slate-200 hover:text-sky-300 hover:underline"
                        >
                          {change.entity_type} #{change.entity_id}
                        </Link>
                      ) : (
                        <span className="font-medium text-slate-200">
                          {change.entity_type}
                        </span>
                      )}

                      <p className="mt-2 text-sm text-slate-400">
                        {change.summary ||
                          `${change.change_type ?? "Change"} — ${change.field_name ?? "field"}`}
                      </p>
                    </div>

                    <span className="text-xs text-slate-600">
                      {change.changed_at
                        ? new Date(
                            change.changed_at,
                          ).toLocaleDateString("en-GB")
                        : "—"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 border-t border-(--border) px-5 pb-5 pt-4 md:grid-cols-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-600">
                        Previous
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {change.old_value ?? "Not recorded"}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-600">
                        New
                      </p>
                      <p className="mt-1 text-sm text-slate-200">
                        {change.new_value ?? "Not recorded"}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">
          Configured alerts
        </h2>

        <div className="mt-4 space-y-3">
          {(alerts ?? []).map((alert) => (
            <div
              key={alert.id}
              className="intel-panel-body intel-surface"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-slate-200">
                    {alert.entity_name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {alert.entity_type} ·{" "}
                    {alert.importance_threshold ?? "medium"} and above
                  </p>
                </div>

                <span className="text-xs text-slate-500">
                  {alert.enabled ? "Active" : "Disabled"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
