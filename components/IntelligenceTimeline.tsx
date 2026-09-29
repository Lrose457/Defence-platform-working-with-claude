type TimelineItem = {
  id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  change_date: string | null;
  changed_at: string;
  change_type: string | null;
  reason: string | null;
  summary: string | null;
  assessment: string | null;
  importance: string | null;
  severity: string | null;
  data_confidence: string | null;
  source_title: string | null;
  source_publisher: string | null;
};

type Props = {
  items: TimelineItem[];
};

function badgeClass(value: string | null) {
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

function dateLabel(item: TimelineItem) {
  const value = item.change_date || item.changed_at;

  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function IntelligenceTimeline({ items }: Props) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-[#071225] p-8 text-center">
        <p className="font-medium text-slate-300">
          No historical intelligence changes
        </p>

        <p className="mt-1 text-sm text-slate-500">
          Changes will appear here when source-backed intelligence is updated.
        </p>
      </div>
    );
  }

  return (
    <section>
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-[9px] top-0 w-px bg-slate-800"
        />

        <div className="space-y-6">
          {items.map((item) => (
            <article
              key={item.id}
              className="relative pl-8"
            >
              <div
                aria-hidden="true"
                className="absolute left-0 top-2 h-[19px] w-[19px] rounded-full border-4 border-[#020817] bg-cyan-400 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]"
              />

              <div className="rounded-2xl border border-slate-800 bg-[#071225] p-5 shadow-lg">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      {dateLabel(item)}
                    </div>

                    <h3 className="mt-1 font-semibold text-white">
                      {item.summary ||
                        `${item.field_name.replaceAll("_", " ")} changed`}
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {item.importance && (
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${badgeClass(
                          item.importance,
                        )}`}
                      >
                        {item.importance}
                      </span>
                    )}

                    {item.severity && (
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${badgeClass(
                          item.severity,
                        )}`}
                      >
                        {item.severity}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-[#040c19] p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      Previous
                    </div>

                    <div className="mt-2 break-words text-sm text-slate-400">
                      {item.old_value || "No previous value"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/[0.03] p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-500">
                      New
                    </div>

                    <div className="mt-2 break-words text-sm text-slate-200">
                      {item.new_value || "No new value"}
                    </div>
                  </div>
                </div>

                {item.assessment && (
                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      Assessment
                    </div>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {item.assessment}
                    </p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
                  <span>
                    Field:{" "}
                    <span className="text-slate-400">
                      {item.field_name.replaceAll("_", " ")}
                    </span>
                  </span>

                  {item.source_title && (
                    <span>
                      Source:{" "}
                      <span className="text-slate-400">
                        {item.source_title}
                      </span>
                    </span>
                  )}

                  {item.data_confidence && (
                    <span>
                      Confidence:{" "}
                      <span className="text-slate-400 capitalize">
                        {item.data_confidence}
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
  );
}