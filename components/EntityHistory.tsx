import { supabase } from "@/lib/supabase/supabase";
import Link from "next/link";

type Change = {
  id: number;
  entity_type: string;
  entity_id: number;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  change_date: string | null;
  reason: string | null;
  data_confidence: string | null;
  change_type: string | null;
  changed_at: string | null;
  notes: string | null;
  source_title: string | null;
  source_publisher: string | null;
};

type Props = {
  entityType: string;
  entityId: number;
  title?: string;
  limit?: number;
};

function formatDate(value: string | null) {
  if (!value) return "Date not recorded";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function confidenceClass(confidence: string | null) {
  switch (confidence?.toLowerCase()) {
    case "high":
      return "border-emerald-800 bg-emerald-950/30 text-emerald-400";

    case "low":
      return "border-amber-800 bg-amber-950/30 text-amber-400";

    default:
      return "border-blue-900 bg-blue-950/30 text-blue-400";
  }
}

function formatFieldName(value: string | null) {
  if (!value) return "Record update";

  const labels: Record<string, string> = {
    record_created: "Record created",
    equipment_added: "Equipment added",
    equipment_removed: "Equipment removed",
    company_added: "Company added",
    company_removed: "Company removed",
    confidence: "Confidence changed",
    status: "Status changed",
    value: "Contract value changed",
    amount_usd: "Spending changed",
    name: "Name changed",
    manufacturer: "Manufacturer changed",
    country_id: "Country changed",
    programme_id: "Programme changed",
  };

  return (
    labels[value] ||
    value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export default async function EntityHistory({
  entityType,
  entityId,
  title = "Intelligence History",
  limit = 20,
}: Props) {
  const { data, error } = await supabase
    .from("intelligence_recent_changes")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("changed_at", { ascending: false })
    .limit(limit);

  if (error) {
    return (
      <section className="rounded-lg border border-(--border) bg-(--surface) p-5">
        <h2 className="text-lg font-semibold">{title}</h2>

        <p className="mt-2 text-xs text-red-400">
          Unable to load intelligence history.
        </p>
      </section>
    );
  }

  const changes = (data || []) as Change[];

  const meaningfulChanges = changes.filter(
    (change) =>
      change.field_name !== "record_created" &&
      change.change_type?.toLowerCase() !== "initial record"
  );

  const initialRecords = changes.filter(
    (change) =>
      change.field_name === "record_created" ||
      change.change_type?.toLowerCase() === "initial record"
  );

  return (
    <section className="rounded-lg border border-(--border) bg-(--surface)">
      <div className="border-b border-(--border) px-5 py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {title}
            </h2>

            <p className="text-xs text-(--foreground-muted)">
              Source-backed changes and relationships recorded
              for this entity.
            </p>
          </div>

          <Link
            href={`/changes?entity=${entityType}`}
            className="text-xs text-blue-400 hover:underline"
          >
            View all {entityType} changes →
          </Link>
        </div>
      </div>

      {changes.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-(--foreground-muted)">
            No intelligence history has been recorded for this
            entity.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-(--border)">
          {meaningfulChanges.map((change) => (
            <div
              key={change.id}
              className="px-5 py-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {change.change_type && (
                      <span className="rounded border border-blue-900 bg-blue-950/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-400">
                        {change.change_type}
                      </span>
                    )}

                    {change.data_confidence && (
                      <span
                        className={`rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${confidenceClass(
                          change.data_confidence
                        )}`}
                      >
                        {change.data_confidence}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 text-sm font-semibold">
                    {formatFieldName(change.field_name)}
                  </h3>

                  {(change.old_value ||
                    change.new_value) && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {change.old_value && (
                        <div className="rounded-md border border-(--border) bg-(--background) p-3">
                          <p className="text-[10px] uppercase tracking-wide text-(--foreground-muted)">
                            Previous
                          </p>

                          <p className="mt-2 break-words text-xs">
                            {change.old_value}
                          </p>
                        </div>
                      )}

                      {change.new_value && (
                        <div className="rounded-md border border-(--border) bg-(--background) p-3">
                          <p className="text-[10px] uppercase tracking-wide text-(--foreground-muted)">
                            Current
                          </p>

                          <p className="mt-2 break-words text-xs">
                            {change.new_value}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {change.reason && (
                    <p className="mt-3 text-xs leading-5 text-(--foreground-muted)">
                      {change.reason}
                    </p>
                  )}

                  {change.source_title && (
                    <p className="mt-3 text-[10px] text-(--foreground-muted)">
                      Source: {change.source_title}
                      {change.source_publisher
                        ? ` · ${change.source_publisher}`
                        : ""}
                    </p>
                  )}
                </div>

                <p className="shrink-0 text-[10px] text-(--foreground-muted)">
                  {formatDate(change.changed_at)}
                </p>
              </div>
            </div>
          ))}

          {initialRecords.length > 0 && (
            <div className="px-5 py-4">
              <details>
                <summary className="cursor-pointer text-xs text-(--foreground-muted) hover:text-(--foreground)">
                  Show {initialRecords.length} initial
                  record
                  {initialRecords.length === 1 ? "" : "s"}
                </summary>

                <div className="mt-4 space-y-3">
                  {initialRecords.map((change) => (
                    <div
                      key={change.id}
                      className="rounded-md border border-(--border) bg-(--background) p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-medium">
                          Initial record
                        </span>

                        <span className="text-[10px] text-(--foreground-muted)">
                          {formatDate(change.changed_at)}
                        </span>
                      </div>

                      {change.source_title && (
                        <p className="mt-2 text-[10px] text-(--foreground-muted)">
                          Source: {change.source_title}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </section>
  );
}