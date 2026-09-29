import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AcceptSourceButton from "@/components/AcceptSourceButton";
type SearchParams = Promise<{
  importance?: string;
  severity?: string;
  confidence?: string;
  reviewed?: string;
  entity?: string;
  changeType?: string;
}>;

type ChangeWithSource = {
  id: number;
  entity_type?: string | null;
  entity_id?: number | null;
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  change_date?: string | null;
  reason?: string | null;
  source_id?: number | null;
  data_confidence?: string | null;
  table_name?: string | null;
  record_id?: number | null;
  change_type?: string | null;
  changed_at?: string | null;
  notes?: string | null;
  importance?: string | null;
  intelligence_eligible?: boolean | null;
  summary?: string | null;
  assessment?: string | null;
  reviewed?: boolean | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  severity?: string | null;
  sources?:
    | {
        title?: string | null;
        publisher?: string | null;
      }
    | Array<{
        title?: string | null;
        publisher?: string | null;
      }>
    | null;
  source_title?: string | null;
  source_publisher?: string | null;
};

const importanceOptions = ["all", "low", "medium", "high"];
const severityOptions = ["all", "low", "medium", "high", "critical"];
const confidenceOptions = ["all", "low", "medium", "high"];
const reviewedOptions = ["all", "reviewed", "unreviewed"];

function clean(value: string | undefined) {
  return value?.trim() || "";
}

function label(value: string | null | undefined) {
  if (!value) return "Not specified";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function importanceClass(value: string | null | undefined) {
  switch (value) {
    case "high":
      return "border-red-900 bg-red-950/40 text-red-300";
    case "medium":
      return "border-amber-900 bg-amber-950/40 text-amber-300";
    case "low":
      return "border-slate-700 bg-slate-900 text-slate-400";
    default:
      return "border-slate-700 bg-slate-900 text-slate-500";
  }
}

function severityClass(value: string | null | undefined) {
  switch (value) {
    case "critical":
      return "border-red-800 bg-red-950 text-red-300";
    case "high":
      return "border-orange-900 bg-orange-950/40 text-orange-300";
    case "medium":
      return "border-amber-900 bg-amber-950/40 text-amber-300";
    case "low":
      return "border-slate-700 bg-slate-900 text-slate-400";
    default:
      return "border-slate-700 bg-slate-900 text-slate-500";
  }
}

function entityHref(
  entityType: string | null | undefined,
  entityId: number | null | undefined,
) {
  if (!entityType || entityId == null) {
    return null;
  }

  const routes: Record<string, string> = {
    country: "countries",
    company: "companies",
    equipment: "equipment",
    programme: "programmes",
    contract: "contracts",
  };

  const route = routes[entityType];

  return route ? `/${route}/${entityId}` : null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Date not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-GB");
}

export default async function Page({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};

  const importance = clean(resolvedSearchParams.importance);
  const severity = clean(resolvedSearchParams.severity);
  const confidence = clean(resolvedSearchParams.confidence);
  const reviewed = clean(resolvedSearchParams.reviewed);
  const entity = clean(resolvedSearchParams.entity);
  const changeType = clean(resolvedSearchParams.changeType);

  const supabase = await createClient();

  let query = supabase
    .from("data_changes")
    .select(`
      *,
      sources (
        title,
        publisher
      )
    `)
    .eq("intelligence_eligible", true)
    .neq("field_name", "record_created")
    .neq("change_type", "Initial record")
    .order("changed_at", { ascending: false })
    .limit(250);

  if (importance && importance !== "all") {
    query = query.eq("importance", importance);
  }

  if (severity && severity !== "all") {
    query = query.eq("severity", severity);
  }

  if (confidence && confidence !== "all") {
    query = query.eq("data_confidence", confidence);
  }

  if (reviewed === "reviewed") {
    query = query.eq("reviewed", true);
  }

  if (reviewed === "unreviewed") {
    query = query.or("reviewed.is.null,reviewed.eq.false");
  }

  if (entity) {
    query = query.ilike("entity_type", `%${entity}%`);
  }

  if (changeType) {
    query = query.ilike("change_type", `%${changeType}%`);
  }

  const { data, error } = await query;

  const changes = ((data ?? []) as ChangeWithSource[]).map(
    (change) => {
      const source = Array.isArray(change.sources)
        ? change.sources[0]
        : change.sources;

      return {
        ...change,
        source_title: source?.title ?? null,
        source_publisher: source?.publisher ?? null,
      };
    },
  );

  const activeFilters = [
    importance && importance !== "all",
    severity && severity !== "all",
    confidence && confidence !== "all",
    reviewed && reviewed !== "all",
    entity,
    changeType,
  ].filter(Boolean).length;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">
          Intelligence
        </p>

        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Intelligence Changes
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Review recorded changes across countries, companies,
              equipment, programmes and contracts.
            </p>
          </div>

          <Link
            href="/intelligence/new"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-sky-700 bg-sky-950 px-4 py-2 text-sm font-medium text-sky-300 hover:bg-sky-900"
          >
            Record intelligence
          </Link>
        </div>
      </header>

      <section
        aria-labelledby="change-filters-heading"
        className="rounded-lg border border-slate-800 bg-slate-950 p-5"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="change-filters-heading"
              className="text-sm font-semibold text-slate-200"
            >
              Filters
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Narrow the intelligence feed to changes that matter.
            </p>
          </div>

          {activeFilters > 0 && (
            <Link
              href="/changes"
              className="text-xs text-sky-400 hover:underline"
            >
              Clear {activeFilters} filter
              {activeFilters === 1 ? "" : "s"}
            </Link>
          )}
        </div>

        <form
          method="GET"
          className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="text-xs text-slate-400">
            <span className="mb-1 block">Importance</span>

            <select
              name="importance"
              defaultValue={importance || "all"}
              className="intel-select"
            >
              {importanceOptions.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-400">
            <span className="mb-1 block">Severity</span>

            <select
              name="severity"
              defaultValue={severity || "all"}
              className="intel-select"
            >
              {severityOptions.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-400">
            <span className="mb-1 block">Confidence</span>

            <select
              name="confidence"
              defaultValue={confidence || "all"}
              className="intel-select"
            >
              {confidenceOptions.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-400">
            <span className="mb-1 block">Review status</span>

            <select
              name="reviewed"
              defaultValue={reviewed || "all"}
              className="intel-select"
            >
              {reviewedOptions.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-400">
            <span className="mb-1 block">Entity type</span>

            <input
              name="entity"
              defaultValue={entity}
              placeholder="e.g. country"
              className="intel-input placeholder:text-slate-500"
            />
          </label>

          <label className="text-xs text-slate-400">
            <span className="mb-1 block">Change type</span>

            <input
              name="changeType"
              defaultValue={changeType}
              placeholder="e.g. Update"
              className="intel-input placeholder:text-slate-500"
            />
          </label>

          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              className="intel-button"
            >
              Apply filters
            </button>
          </div>
        </form>
      </section>

      {error && (
        <section className="rounded-lg border border-red-900 bg-red-950/30 p-5">
          <h2 className="font-semibold text-red-300">
            Unable to load intelligence changes
          </h2>

          <p className="mt-2 text-sm leading-6 text-red-400">
            {error.message}
          </p>
        </section>
      )}

      <section
        aria-labelledby="change-feed-heading"
        className="space-y-4"
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2
              id="change-feed-heading"
              className="text-xl font-semibold"
            >
              Change feed
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Showing {changes.length} recorded change
              {changes.length === 1 ? "" : "s"}.
            </p>
          </div>
        </div>

        {changes.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-8 text-center">
            <p className="text-sm font-medium text-slate-300">
              No matching intelligence changes.
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              Try clearing one or more filters.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {changes.map((change) => {
              const href = entityHref(
                change.entity_type,
                change.entity_id,
              );

              return (
                <article
                  key={change.id}
                  className="rounded-lg border border-slate-800 bg-slate-950 p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {href ? (
                          <Link
                            href={href}
                            className="font-medium text-slate-100 hover:text-sky-300 hover:underline"
                          >
                            {label(change.entity_type)} #
                            {change.entity_id}
                          </Link>
                        ) : (
                          <span className="font-medium text-slate-100">
                            {label(change.entity_type)}
                          </span>
                        )}

                        {change.importance && (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] ${importanceClass(
                              change.importance,
                            )}`}
                          >
                            {label(change.importance)}
                          </span>
                        )}

                        {change.severity && (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] ${severityClass(
                              change.severity,
                            )}`}
                          >
                            {label(change.severity)}
                          </span>
                        )}

                        {change.reviewed ? (
                          <span className="rounded-full border border-emerald-900 bg-emerald-950/30 px-2 py-0.5 text-[11px] text-emerald-400">
                            Reviewed
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-500">
                            Unreviewed
                          </span>
                        )}
                      </div>

                      <h3 className="mt-3 text-base font-semibold text-slate-200">
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

                    <div className="shrink-0 text-left lg:text-right">
                      <p className="text-xs text-slate-500">
                        {formatDate(
                          change.changed_at ?? change.change_date,
                        )}
                      </p>

                      {change.data_confidence && (
                        <p className="mt-1 text-xs text-slate-600">
                          Confidence:{" "}
                          {label(change.data_confidence)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 border-t border-slate-800 pt-4 md:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                        Previous
                      </p>

                      <p className="mt-2 break-words text-sm text-slate-400">
                        {change.old_value ?? "Not recorded"}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                        New
                      </p>

                      <p className="mt-2 break-words text-sm text-slate-200">
                        {change.new_value ?? "Not recorded"}
                      </p>
                    </div>
                  </div>

                  {(change.source_title ||
                    change.source_publisher ||
                    change.notes ||
                    !change.reviewed) && (
  <div className="mt-4 border-t border-slate-800 pt-4">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {change.source_title && (
          <p className="text-xs text-slate-500">
            Source:{" "}
            <span className="text-slate-300">
              {change.source_title}
            </span>
          </p>
        )}

        {change.source_publisher && (
          <p className="mt-1 text-xs text-slate-600">
            {change.source_publisher}
          </p>
        )}

        {change.notes && (
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {change.notes}
          </p>
        )}
      </div>

      {!change.reviewed &&
        change.intelligence_eligible && (
          <div className="shrink-0">
            <AcceptSourceButton
              changeId={change.id}
              sourceTitle={change.source_title}
            />
          </div>
        )}
    </div>
  </div>
)}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
