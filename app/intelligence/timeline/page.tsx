import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type TimelineRow = {
  change_id: number;
  country_id: number;
  country_name: string;
  entity_type: string;
  entity_id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  change_type: string | null;
  change_date: string | null;
  changed_at: string;
  reason: string | null;
  summary: string | null;
  assessment: string | null;
  notes: string | null;
  importance: string | null;
  severity: string | null;
  data_confidence: string | null;
  source_id: number | null;
  source_title: string | null;
  source_publisher: string | null;
  source_url: string | null;
  budget_year: number | null;
};

function badge(value: string | null) {
  switch ((value || "").toLowerCase()) {
    case "critical":
      return "border-red-400/30 bg-red-400/10 text-red-300";

    case "high":
      return "border-orange-400/30 bg-orange-400/10 text-orange-300";

    case "medium":
      return "border-cyan-400/30 bg-cyan-400/10 text-cyan-300";

    default:
      return "border-slate-700 bg-slate-800/50 text-slate-400";
  }
}

function formatDate(value: string | null) {
  if (!value) return "Unknown date";

  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatField(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function IntelligenceTimelinePage({
  searchParams,
}: {
  searchParams: Promise<{
    country?: string;
  }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();

  let query = supabase
    .from("country_historical_intelligence")
    .select("*")
    .order("changed_at", {
      ascending: false,
    })
    .limit(500);

  if (params.country) {
    query = query.eq("country_id", Number(params.country));
  }

  const { data, error } = await query;

  const rows = (data || []) as TimelineRow[];

  const countryCount = new Set(
    rows.map((row) => row.country_id),
  ).size;

  const highImportance = rows.filter(
    (row) => row.importance === "high",
  ).length;

  const highConfidence = rows.filter(
    (row) => row.data_confidence?.toLowerCase() === "high",
  ).length;

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-7 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-8">
          <Link
            href="/intelligence"
            className="text-xs font-medium text-slate-500 transition hover:text-cyan-300"
          >
            ← Intelligence
          </Link>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Historical analysis
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Intelligence timeline
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Review source-backed changes over time. Budget intelligence is
              linked back to the country it belongs to, allowing historical
              defence developments to be analysed at country level.
            </p>
          </div>
        </header>

        {/* Metrics */}
        <section
          aria-label="Historical intelligence summary"
          className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <div className="rounded-2xl border border-slate-800 bg-[#071225] p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Historical changes
            </div>

            <div className="mt-3 text-3xl font-semibold text-white">
              {rows.length}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Source-backed records loaded
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#071225] p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Countries
            </div>

            <div className="mt-3 text-3xl font-semibold text-cyan-300">
              {countryCount}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Countries represented
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#071225] p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              High importance
            </div>

            <div className="mt-3 text-3xl font-semibold text-amber-300">
              {highImportance}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Changes marked high importance
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#071225] p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              High confidence
            </div>

            <div className="mt-3 text-3xl font-semibold text-emerald-300">
              {highConfidence}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Records with high confidence
            </div>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-400/5 p-5">
            <p className="text-sm font-medium text-red-300">
              Historical intelligence could not be loaded.
            </p>

            <p className="mt-2 text-xs text-red-200/60">
              {error.message}
            </p>
          </div>
        )}

        {/* Empty state */}
        {!error && rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-[#071225] px-6 py-16 text-center">
            <h2 className="text-lg font-semibold text-white">
              No historical intelligence found
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
              No source-backed changes matched this view. Try removing the
              country filter or return to the global intelligence feed.
            </p>

            <Link
              href="/intelligence"
              className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-cyan-400 px-5 text-sm font-semibold text-slate-950"
            >
              Open intelligence feed
            </Link>
          </div>
        )}

        {/* Timeline */}
        {rows.length > 0 && (
          <section
            aria-label="Historical intelligence changes"
            className="rounded-2xl border border-slate-800 bg-[#071225] p-5 shadow-2xl sm:p-7"
          >
            <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Change history
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Most recent source-backed changes first.
                </p>
              </div>

              <span className="text-xs text-slate-600">
                Showing up to 500 records
              </span>
            </div>

            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute bottom-0 left-[9px] top-0 w-px bg-slate-800"
              />

              <div className="space-y-6">
                {rows.map((row) => (
                  <article
                    key={row.change_id}
                    className="relative pl-8"
                  >
                    <div
                      aria-hidden="true"
                      className="absolute left-0 top-2 h-[19px] w-[19px] rounded-full border-4 border-[#071225] bg-cyan-400"
                    />

                    <div className="rounded-2xl border border-slate-800 bg-[#040c19] p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                              {formatDate(
                                row.change_date ||
                                  row.changed_at,
                              )}
                            </span>

                            <span className="text-slate-700">
                              •
                            </span>

                            <span className="text-xs text-slate-500">
                              {row.country_name}
                            </span>

                            {row.budget_year && (
                              <>
                                <span className="text-slate-700">
                                  •
                                </span>

                                <span className="text-xs text-slate-500">
                                  Budget year {row.budget_year}
                                </span>
                              </>
                            )}
                          </div>

                          <h3 className="mt-2 text-base font-semibold text-white">
                            {row.summary ||
                              `${formatField(row.field_name)} updated`}
                          </h3>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {row.importance && (
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${badge(
                                row.importance,
                              )}`}
                            >
                              {row.importance}
                            </span>
                          )}

                          {row.severity && (
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${badge(
                                row.severity,
                              )}`}
                            >
                              {row.severity}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-800 bg-[#071225] p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                            Previous
                          </div>

                          <div className="mt-2 break-all text-sm text-slate-400">
                            {row.old_value ?? "No previous value"}
                          </div>
                        </div>

                        <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/[0.03] p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-500">
                            New
                          </div>

                          <div className="mt-2 break-all text-sm font-medium text-slate-200">
                            {row.new_value ?? "No new value"}
                          </div>
                        </div>
                      </div>

                      {row.assessment && (
                        <div className="mt-4 rounded-xl border border-slate-800 bg-[#071225] p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                            Analyst assessment
                          </div>

                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {row.assessment}
                          </p>
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
                        <span>
                          Field:{" "}
                          <span className="text-slate-400">
                            {formatField(row.field_name)}
                          </span>
                        </span>

                        {row.data_confidence && (
                          <span>
                            Confidence:{" "}
                            <span className="text-slate-400">
                              {row.data_confidence}
                            </span>
                          </span>
                        )}

                        {row.source_title && (
                          <span>
                            Source:{" "}
                            <span className="text-slate-400">
                              {row.source_title}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}