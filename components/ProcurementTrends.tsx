import { formatLabel } from "@/lib/format";

type EventRow = {
  id: number;
  event_date: string | null;
  event_type: string | null;
  value_usd: number | null;
};

/**
 * Trends section (doc: "Track trends in what countries are procuring").
 * Server-rendered aggregate of the currently filtered event set: spend by
 * year and event-mix by type. No client JS — recharts was avoided on
 * purpose so this stays cheap inside the page payload.
 */
export default function ProcurementTrends({ events }: { events: EventRow[] }) {
  if (events.length === 0) return null;

  const byYear = new Map<string, { total: number; count: number }>();
  const byType = new Map<string, number>();

  for (const e of events) {
    if (e.value_usd != null && e.event_date) {
      const year = e.event_date.slice(0, 4);
      const agg = byYear.get(year) ?? { total: 0, count: 0 };
      agg.total += e.value_usd;
      agg.count += 1;
      byYear.set(year, agg);
    }
    const type = e.event_type ?? "other";
    byType.set(type, (byType.get(type) ?? 0) + 1);
  }

  const years = [...byYear.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8);
  const maxTotal = Math.max(...years.map(([, v]) => v.total), 1);
  const types = [...byType.entries()].sort(([, a], [, b]) => b - a).slice(0, 6);
  const maxCount = Math.max(...types.map(([, v]) => v), 1);

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-slate-800 bg-slate-950 p-5">
        <h2 className="text-sm font-semibold text-slate-200">Recorded value by year</h2>
        <p className="mt-1 text-xs text-slate-500">
          Total disclosed value of matching events per year.
        </p>
        <div className="mt-4 flex h-40 items-end gap-2">
          {years.map(([year, { total }]) => (
            <div key={year} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-sky-700/70"
                style={{ height: `${Math.max(4, (total / maxTotal) * 100)}%` }}
                title={`${year}: $${(total / 1_000_000_000).toFixed(1)}bn`}
              />
              <span className="text-[10px] font-mono text-slate-500">{year}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950 p-5">
        <h2 className="text-sm font-semibold text-slate-200">Event mix</h2>
        <p className="mt-1 text-xs text-slate-500">
          Composition of matching events by type.
        </p>
        <ul className="mt-4 space-y-2">
          {types.map(([type, count]) => (
            <li key={type} className="flex items-center gap-3 text-xs">
              <span className="w-24 shrink-0 text-slate-400">{formatLabel(type)}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded bg-slate-900">
                <div
                  className="h-full rounded bg-sky-600"
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right font-mono text-slate-500">{count}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
