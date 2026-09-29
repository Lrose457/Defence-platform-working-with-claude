import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type WatchlistRow = {
  id: number;
  entity_type: string;
  entity_id: number;
  entity_name: string;
  priority: string | null;
  notes: string | null;
  created_at: string;
  intelligence_change_count: number | string | null;
  high_importance_change_count: number | string | null;
  latest_change_at: string | null;
};

const paths: Record<string, string> = {
  country: "/countries",
  company: "/companies",
  equipment: "/equipment",
  programme: "/programmes",
  contract: "/contracts",
};

function numberValue(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function priorityClass(priority: string | null) {
  switch ((priority || "medium").toLowerCase()) {
    case "high":
      return "border-red-400/30 bg-red-400/10 text-red-300";
    case "low":
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
    default:
      return "border-cyan-400/30 bg-cyan-400/10 text-cyan-300";
  }
}

function formatDate(value: string | null) {
  if (!value) return "No recorded change";

  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function WatchlistPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="min-h-screen bg-[#020817] px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-slate-800 bg-[#071225] p-10 text-center shadow-2xl">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Analyst workspace
            </div>

            <h1 className="text-3xl font-semibold tracking-tight">
              Watchlist
            </h1>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
              Save countries, companies, programmes, equipment and contracts
              that you want to monitor.
            </p>

            <Link
              href="/account/login"
              className="mt-7 inline-flex min-h-11 items-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/15 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { data, error } = await supabase
    .from("watchlist_intelligence_summary")
    .select("*")
    .eq("user_id", user.id)
    .order("high_importance_change_count", {
      ascending: false,
    })
    .order("latest_change_at", {
      ascending: false,
      nullsFirst: false,
    });

  const rows = error ? [] : ((data || []) as WatchlistRow[]);

  const totalEntities = rows.length;

  const highPriority = rows.filter(
    (row) => (row.priority || "medium").toLowerCase() === "high",
  ).length;

  const totalChanges = rows.reduce(
    (sum, row) => sum + numberValue(row.intelligence_change_count),
    0,
  );

  const highImportance = rows.reduce(
    (sum, row) =>
      sum + numberValue(row.high_importance_change_count),
    0,
  );

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-7 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-375">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
                Analyst workspace
              </div>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Watchlist
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Monitor important defence entities and surface intelligence
                changes that may require analyst attention.
              </p>
            </div>

            <Link
              href="/search"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-[#071225] px-4 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-[#0a172c] focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
            >
              Find entities
            </Link>
          </div>
        </header>

        {/* Metrics */}
        <section
          aria-label="Watchlist summary"
          className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <div className="rounded-2xl border border-slate-800 bg-[#071225] p-5 shadow-lg">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Watched entities
            </div>

            <div className="mt-3 text-3xl font-semibold text-white">
              {totalEntities}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Across your workspace
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#071225] p-5 shadow-lg">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              High priority
            </div>

            <div className="mt-3 text-3xl font-semibold text-red-300">
              {highPriority}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Entities requiring closer attention
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#071225] p-5 shadow-lg">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Intelligence changes
            </div>

            <div className="mt-3 text-3xl font-semibold text-cyan-300">
              {totalChanges}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Eligible changes linked to your watchlist
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#071225] p-5 shadow-lg">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              High importance
            </div>

            <div className="mt-3 text-3xl font-semibold text-amber-300">
              {highImportance}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              High-importance changes
            </div>
          </div>
        </section>

        {/* Main panel */}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#071225] shadow-2xl">
          <div className="flex flex-col gap-3 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Watched entities
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Sorted by intelligence activity and importance.
              </p>
            </div>

            <div className="text-xs text-slate-500">
              {totalEntities} {totalEntities === 1 ? "entity" : "entities"}
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-cyan-300">
                +
              </div>

              <h3 className="mt-5 text-base font-semibold text-white">
                Nothing on your watchlist
              </h3>

              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                Open a country, company, programme, equipment system or
                contract and use the Watch control to add it here.
              </p>

              <Link
                href="/search"
                className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-cyan-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
              >
                Search entities
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-225 w-full text-left text-sm">
                <caption className="sr-only">
                  Defence intelligence watchlist
                </caption>

                <thead className="border-b border-slate-800 bg-[#09172b]">
                  <tr>
                    <th
                      scope="col"
                      className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Entity
                    </th>

                    <th
                      scope="col"
                      className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Priority
                    </th>

                    <th
                      scope="col"
                      className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Changes
                    </th>

                    <th
                      scope="col"
                      className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      High importance
                    </th>

                    <th
                      scope="col"
                      className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Latest change
                    </th>

                    <th
                      scope="col"
                      className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Open
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800/80">
                  {rows.map((row) => {
                    const basePath = paths[row.entity_type];

                    return (
                      <tr
                        key={row.id}
                        className="transition hover:bg-[#0a182d]"
                      >
                        <td className="px-5 py-5">
                          {basePath ? (
                            <Link
                              href={`${basePath}/${row.entity_id}`}
                              className="font-medium text-white hover:text-cyan-300 hover:underline focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                            >
                              {row.entity_name}
                            </Link>
                          ) : (
                            <span className="font-medium text-white">
                              {row.entity_name}
                            </span>
                          )}

                          <div className="mt-1 text-xs capitalize text-slate-500">
                            {row.entity_type}
                          </div>
                        </td>

                        <td className="px-5 py-5">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${priorityClass(
                              row.priority,
                            )}`}
                          >
                            {row.priority || "medium"}
                          </span>
                        </td>

                        <td className="px-5 py-5 font-medium text-slate-300">
                          {numberValue(row.intelligence_change_count)}
                        </td>

                        <td className="px-5 py-5 font-medium text-amber-300">
                          {numberValue(row.high_importance_change_count)}
                        </td>

                        <td className="px-5 py-5 text-slate-400">
                          {formatDate(row.latest_change_at)}
                        </td>

                        <td className="px-5 py-5 text-right">
                          {basePath ? (
                            <Link
                              href={`${basePath}/${row.entity_id}`}
                              className="inline-flex min-h-10 items-center rounded-lg border border-slate-700 px-3 text-xs font-medium text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                            >
                              View
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}