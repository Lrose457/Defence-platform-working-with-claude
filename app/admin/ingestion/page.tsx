import Link from "next/link";

import { IngestionReviewPanel } from "@/components/IngestionReviewPanel";
import { createClient } from "@/lib/supabase/server";

type Summary = {
  active_sources: number;
  pending_records: number;
  approved_records: number;
  rejected_records: number;
  processed_records: number;
  running_runs: number;
  latest_successful_run: string | null;
  failed_runs: number;
};

type QueueSummary = {
  status: string;
  entity_type: string;
  record_count: number;
  oldest_record: string | null;
  newest_record: string | null;
};

type SourceSummary = {
  source_id: number;
  source_title: string;
  publisher: string | null;
  pending_records: number;
  oldest_record: string | null;
  newest_record: string | null;
};

type PendingReviewRow = {
  id: number;
  source_id: number | null;
  entity_type: string | null;
  entity_id: number | null;
  title: string | null;
  source_url: string | null;
  published_at: string | null;
  retrieved_at: string | null;
  verification_status: string | null;
  data_confidence: string | null;
  confidence_score: number | null;
  created_at: string | null;
  sources: {
    id: number;
    title: string | null;
    publisher: string | null;
  }[];
};

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function IngestionPage({
  searchParams,
}: {
  searchParams: Promise<{ source_id?: string | string[] }>;
}) {
  const supabase = await createClient();
  const resolvedParams = await searchParams;
  const selectedSourceId =
    typeof resolvedParams.source_id === "string"
      ? Number(resolvedParams.source_id)
      : Array.isArray(resolvedParams.source_id)
        ? Number(resolvedParams.source_id[0])
        : null;

  const [
    summaryResult,
    queueResult,
    sourceResult,
    selectedSourceResult,
  ] = await Promise.all([
    supabase
      .from("ingestion_pipeline_summary_v2")
      .select("*")
      .single(),

    supabase
      .from("ingestion_queue_summary_v2")
      .select("*"),

    supabase
      .from("ingestion_queue")
      .select(
        `
          source_id,
          created_at,
          sources (
            id,
            title,
            publisher
          )
        `,
      )
      .eq("review_status", "pending")
      .not("source_id", "is", null)
      .order("created_at", {
        ascending: true,
      }),
    selectedSourceId && Number.isInteger(selectedSourceId)
      ? supabase
          .from("ingestion_queue")
          .select(
            `
              id,
              source_id,
              entity_type,
              entity_id,
              title,
              source_url,
              published_at,
              retrieved_at,
              verification_status,
              data_confidence,
              confidence_score,
              created_at,
              sources (
                id,
                title,
                publisher
              )
            `,
          )
          .eq("source_id", selectedSourceId)
          .eq("review_status", "pending")
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const summary =
    summaryResult.data as Summary | null;

  const queue =
    (queueResult.data || []) as QueueSummary[];

  const pendingReviewRows =
    (selectedSourceResult.data || []) as PendingReviewRow[];

  /*
   * Group pending queue records by source.
   *
   * We do this in the page rather than changing one of the
   * existing ingestion views.
   */
  const sourceMap = new Map<
    number,
    SourceSummary
  >();

  for (const row of sourceResult.data || []) {
    const source = Array.isArray(row.sources)
      ? row.sources[0]
      : row.sources;

    if (!source?.id) continue;

    const sourceId = Number(source.id);

    const existing = sourceMap.get(sourceId);

    if (!existing) {
      sourceMap.set(sourceId, {
        source_id: sourceId,
        source_title:
          source.title || "Unknown source",
        publisher:
          source.publisher || null,
        pending_records: 1,
        oldest_record:
          row.created_at || null,
        newest_record:
          row.created_at || null,
      });

      continue;
    }

    existing.pending_records += 1;

    if (
      row.created_at &&
      (!existing.oldest_record ||
        row.created_at <
          existing.oldest_record)
    ) {
      existing.oldest_record =
        row.created_at;
    }

    if (
      row.created_at &&
      (!existing.newest_record ||
        row.created_at >
          existing.newest_record)
    ) {
      existing.newest_record =
        row.created_at;
    }
  }

  const sourceGroups =
    Array.from(sourceMap.values()).sort(
      (a, b) =>
        b.pending_records -
        a.pending_records,
    );

  const selectedSource =
    sourceGroups.find((source) => source.source_id === selectedSourceId) ?? null;

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-7 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/admin"
          className="text-xs font-medium text-slate-500 hover:text-cyan-300"
        >
          ← Admin
        </Link>

        <header className="mt-5 mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Data operations
          </p>

          <h1 className="mt-2 text-3xl font-semibold text-white">
            Ingestion pipeline
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Monitor source ingestion, pending
            records, processing runs and
            review activity before information
            enters the core intelligence
            database.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Active sources"
            value={
              summary?.active_sources ?? 0
            }
          />

          <Metric
            label="Pending review"
            value={
              summary?.pending_records ?? 0
            }
          />

          <Metric
            label="Processed"
            value={
              summary?.processed_records ?? 0
            }
          />

          <Metric
            label="Failed runs"
            value={
              summary?.failed_runs ?? 0
            }
          />
        </section>

        {(summaryResult.error ||
          queueResult.error ||
          sourceResult.error) && (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-300">
            {summaryResult.error?.message ||
              queueResult.error?.message ||
              sourceResult.error?.message}
          </div>
        )}

        <section className="mt-8 rounded-2xl border border-slate-800 bg-[#071225] p-5 sm:p-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Pending by source
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Review pending records grouped
                by their original source. Only
                records currently marked as
                pending are eligible for bulk
                approval.
              </p>
            </div>

            <Link
              href="/admin/ingestion/import"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:border-slate-600 hover:bg-slate-800"
            >
              Import data
            </Link>
          </div>

          {sourceGroups.length === 0 ? (
            <div className="mt-6 rounded-xl border border-slate-800 bg-[#040c19] p-6">
              <p className="font-medium text-white">
                No pending source-backed entries
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                New source-backed ingestion
                records will appear here when
                they require review.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {sourceGroups.map((source) => (
                <div
                  key={source.source_id}
                  className="rounded-xl border border-slate-800 bg-[#040c19] p-5"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-base font-semibold text-white">
                          {source.source_title}
                        </h3>

                        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
                          {source.pending_records.toLocaleString()}{" "}
                          pending
                        </span>
                      </div>

                      {source.publisher && (
                        <p className="mt-1 text-sm text-slate-500">
                          {source.publisher}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
                        <span>
                          Oldest:{" "}
                          {formatDate(
                            source.oldest_record,
                          )}
                        </span>

                        <span>
                          Newest:{" "}
                          {formatDate(
                            source.newest_record,
                          )}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/admin/ingestion?source_id=${source.source_id}`}
                      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 hover:border-cyan-400/50 hover:bg-cyan-500/20"
                    >
                      Review pending records
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {selectedSourceId && selectedSource && (
          <IngestionReviewPanel
            items={pendingReviewRows.map((row) => ({
              id: row.id,
              source_id: row.source_id,
              entity_type: row.entity_type,
              entity_id: row.entity_id,
              title: row.title,
              source_url: row.source_url,
              published_at: row.published_at,
              retrieved_at: row.retrieved_at,
              verification_status: row.verification_status,
              data_confidence: row.data_confidence,
              confidence_score: row.confidence_score,
              created_at: row.created_at,
              source: row.sources?.[0]
                ? {
                    title: row.sources[0].title,
                    publisher: row.sources[0].publisher,
                  }
                : null,
            }))}
            sourceId={selectedSourceId}
            sourceTitle={selectedSource.source_title}
            sourcePublisher={selectedSource.publisher}
          />
        )}

        <section className="mt-8 rounded-2xl border border-slate-800 bg-[#071225] p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-white">
            Pipeline state
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatusCard
              label="Pending"
              value={
                summary?.pending_records ?? 0
              }
            />

            <StatusCard
              label="Approved"
              value={
                summary?.approved_records ?? 0
              }
            />

            <StatusCard
              label="Rejected"
              value={
                summary?.rejected_records ?? 0
              }
            />

            <StatusCard
              label="Running"
              value={
                summary?.running_runs ?? 0
              }
            />
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-[#071225] p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-white">
            Queue summary
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Records currently represented in the
            ingestion queue.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[750px] text-left text-sm">
              <caption className="sr-only">
                Ingestion queue summary
              </caption>

              <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-600">
                <tr>
                  <th
                    scope="col"
                    className="px-3 py-3"
                  >
                    Status
                  </th>

                  <th
                    scope="col"
                    className="px-3 py-3"
                  >
                    Entity
                  </th>

                  <th
                    scope="col"
                    className="px-3 py-3"
                  >
                    Records
                  </th>

                  <th
                    scope="col"
                    className="px-3 py-3"
                  >
                    Oldest
                  </th>

                  <th
                    scope="col"
                    className="px-3 py-3"
                  >
                    Newest
                  </th>
                </tr>
              </thead>

              <tbody>
                {queue.map((row) => (
                  <tr
                    key={`${row.status}-${row.entity_type}`}
                    className="border-b border-slate-800/70 last:border-0"
                  >
                    <td className="px-3 py-4 text-slate-300">
                      {row.status}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {row.entity_type}
                    </td>

                    <td className="px-3 py-4 font-medium text-white">
                      {row.record_count}
                    </td>

                    <td className="px-3 py-4 text-slate-500">
                      {formatDate(
                        row.oldest_record,
                      )}
                    </td>

                    <td className="px-3 py-4 text-slate-500">
                      {formatDate(
                        row.newest_record,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-[#071225] p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-white">
            Pipeline model
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {[
              [
                "1",
                "Discover",
                "Find a source-backed update.",
              ],
              [
                "2",
                "Normalise",
                "Convert it into platform fields.",
              ],
              [
                "3",
                "Review",
                "Check provenance and confidence.",
              ],
              [
                "4",
                "Publish",
                "Write the approved record.",
              ],
            ].map(
              ([number, title, description]) => (
                <div
                  key={number}
                  className="rounded-xl border border-slate-800 bg-[#040c19] p-4"
                >
                  <div className="text-xs font-semibold text-cyan-400">
                    {number}
                  </div>

                  <h3 className="mt-2 font-medium text-white">
                    {title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {description}
                  </p>
                </div>
              ),
            )}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-[#071225] p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-white">
            Latest successful run
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {formatDate(
              summary?.latest_successful_run ??
                null,
            )}
          </p>
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#071225] p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </div>

      <div className="mt-3 text-3xl font-semibold text-white">
        {value}
      </div>
    </div>
  );
}

function StatusCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#040c19] p-4">
      <div className="text-xs uppercase tracking-wider text-slate-600">
        {label}
      </div>

      <div className="mt-2 text-2xl font-semibold text-white">
        {value}
      </div>
    </div>
  );
}