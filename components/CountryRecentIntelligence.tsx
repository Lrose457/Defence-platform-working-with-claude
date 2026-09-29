import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Props = {
  countryId: number;
};

function label(value: string | null | undefined) {
  if (!value) return "Not specified";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function badgeClass(value: string | null | undefined) {
  switch (value) {
    case "high":
    case "critical":
      return "border-red-900 bg-red-950/40 text-red-300";
    case "medium":
      return "border-amber-900 bg-amber-950/40 text-amber-300";
    default:
      return "border-slate-700 bg-slate-900 text-slate-500";
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Date not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB");
}

export default async function CountryRecentIntelligence({
  countryId,
}: Props) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("data_changes")
    .select(`
      id,
      field_name,
      old_value,
      new_value,
      change_date,
      changed_at,
      change_type,
      importance,
      severity,
      data_confidence,
      summary,
      assessment,
      source_id,
      sources (
        title,
        publisher
      )
    `)
    .eq("entity_type", "country")
    .eq("entity_id", countryId)
    .eq("intelligence_eligible", true)
    .neq("field_name", "record_created")
    .neq("change_type", "Initial record")
    .order("changed_at", { ascending: false })
    .limit(8);

  const changes = data ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">
            Intelligence
          </p>

          <h2 className="mt-2 text-xl font-semibold">
            Recent intelligence
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Recent recorded intelligence changes relating to this country.
          </p>
        </div>

        <Link
          href={`/changes?entity=country`}
          className="text-sm text-sky-400 hover:underline"
        >
          View intelligence feed →
        </Link>
      </div>

      {changes.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
          <p className="text-sm text-slate-400">
            No eligible intelligence changes are currently recorded for this
            country.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {changes.map((change) => {
            const source = Array.isArray(change.sources)
              ? change.sources[0]
              : change.sources;

            return (
              <article
                key={change.id}
                className="rounded-lg border border-slate-800 bg-slate-950 p-5"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {change.importance && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${badgeClass(
                            change.importance,
                          )}`}
                        >
                          {label(change.importance)}
                        </span>
                      )}

                      {change.severity && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${badgeClass(
                            change.severity,
                          )}`}
                        >
                          {label(change.severity)}
                        </span>
                      )}

                      {change.data_confidence && (
                        <span className="text-[11px] text-slate-600">
                          {label(change.data_confidence)} confidence
                        </span>
                      )}
                    </div>

                    <h3 className="mt-3 font-semibold text-slate-200">
                      {change.summary ||
                        `${label(change.change_type)} — ${label(
                          change.field_name,
                        )}`}
                    </h3>

                    {change.assessment && (
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {change.assessment}
                      </p>
                    )}
                  </div>

                  <time className="shrink-0 text-xs text-slate-600">
                    {formatDate(change.changed_at ?? change.change_date)}
                  </time>
                </div>

                <div className="mt-4 grid gap-4 border-t border-slate-800 pt-4 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      Previous
                    </p>

                    <p className="mt-1 break-words text-sm text-slate-500">
                      {change.old_value ?? "Not recorded"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      New
                    </p>

                    <p className="mt-1 break-words text-sm text-slate-200">
                      {change.new_value ?? "Not recorded"}
                    </p>
                  </div>
                </div>

                {source?.title && (
                  <p className="mt-4 text-xs text-slate-600">
                    Source:{" "}
                    <span className="text-slate-500">
                      {source.title}
                    </span>
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}