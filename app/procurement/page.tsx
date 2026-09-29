import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatLabel, formatDateHuman, formatUsd } from "@/lib/format";
import ProcurementTrends from "@/components/ProcurementTrends";

type SearchParams = Promise<{
  country?: string;
  importance?: string;
  eventType?: string;
  branch?: string;
  costBand?: string;
}>;

type EventRow = {
  id: number;
  event_date: string | null;
  country_id: number | null;
  country_name: string | null;
  title: string | null;
  event_type: string | null;
  importance: string | null;
  branch: string | null;
  value_usd: number | null;
  contract_id: number | null;
};

const BRANCHES = ["army", "navy", "air_force", "joint", "space"] as const;

const COST_BANDS = [
  { id: "micro", label: "< $10m", min: 0, max: 10_000_000 },
  { id: "small", label: "$10m – $100m", min: 10_000_000, max: 100_000_000 },
  { id: "medium", label: "$100m – $1bn", min: 100_000_000, max: 1_000_000_000 },
  { id: "major", label: "$1bn – $10bn", min: 1_000_000_000, max: 10_000_000_000 },
  { id: "mega", label: "> $10bn", min: 10_000_000_000, max: Number.POSITIVE_INFINITY },
] as const;

const PAGE_SIZE = 200;

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const params = (await searchParams) ?? {};

  const country = params.country ?? "all";
  const importance = params.importance ?? "all";
  const eventType = params.eventType ?? "all";
  const branch = params.branch ?? "all";
  const costBand = params.costBand ?? "all";

  const supabase = await createClient();

  const [{ data: countries }, { data: allEvents, error }, { count }] =
    await Promise.all([
      supabase.from("countries").select("id, name").order("name"),

      (() => {
        let query = supabase
          .from("procurement_activity")
          .select(
            "id, event_date, country_id, country_name, title, event_type, importance, branch, value_usd, contract_id",
          )
          .order("event_date", { ascending: false })
          .limit(5_000);

        if (country !== "all") query = query.eq("country_id", Number(country));
        if (importance !== "all") query = query.eq("importance", importance);
        if (eventType !== "all") query = query.eq("event_type", eventType);
        if (branch !== "all") query = query.eq("branch", branch);

        return query;
      })(),

      supabase
        .from("procurement_activity")
        .select("id", { count: "exact", head: true }),
    ]);

  let rows = (allEvents ?? []) as EventRow[];

  /* Cost-band filtering needs values, so apply in-page (data-driven band edges). */
  const band = COST_BANDS.find((b) => b.id === costBand);
  if (band) {
    rows = rows.filter(
      (r) =>
        r.value_usd != null && r.value_usd >= band.min && r.value_usd < band.max,
    );
  }

  const rowsShown = rows.slice(0, PAGE_SIZE);

  const highCount = rows.filter((r) => r.importance === "high").length;
  const latestDate = rows[0]?.event_date ?? null;
  const hiddenCount = rows.length - rowsShown.length;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">
          Intelligence
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Procurement</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          Track recorded defence procurement events, contracts and programme
          activity.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Matching events", value: rows.length.toLocaleString() },
          { label: "Total in database", value: (count ?? 0).toLocaleString() },
          { label: "High importance", value: highCount.toLocaleString() },
          { label: "Latest event", value: latestDate ? formatDateHuman(latestDate) : "None" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-slate-800 bg-slate-950 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-600">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </section>

      <ProcurementTrends events={rows} />

      <section className="rounded-lg border border-slate-800 bg-slate-950 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Filters</h2>
            <p className="mt-1 text-xs text-slate-500">
              Narrow procurement activity to the records you need.
            </p>
          </div>
          <Link href="/procurement" className="text-xs text-sky-400 hover:underline">
            Clear filters
          </Link>
        </div>

        <form method="GET" className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-slate-400">
            <span className="mb-1 block">Country</span>
            <select
              name="country"
              defaultValue={country}
              className="min-h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
            >
              <option value="all">All countries</option>
              {(countries ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-400">
            <span className="mb-1 block">Importance</span>
            <select
              name="importance"
              defaultValue={importance}
              className="min-h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
            >
              <option value="all">All levels</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>

          <label className="text-xs text-slate-400">
            <span className="mb-1 block">Event type</span>
            <select
              name="eventType"
              defaultValue={eventType}
              className="min-h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
            >
              <option value="all">All event types</option>
              <option value="contract">Contract</option>
              <option value="award">Award</option>
              <option value="announcement">Announcement</option>
              <option value="delivery">Delivery</option>
              <option value="milestone">Milestone</option>
            </select>
          </label>

          <label className="text-xs text-slate-400">
            <span className="mb-1 block">Branch</span>
            <select
              name="branch"
              defaultValue={branch}
              className="min-h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
            >
              <option value="all">All branches</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {formatLabel(b)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-400">
            <span className="mb-1 block">Cost band</span>
            <select
              name="costBand"
              defaultValue={costBand}
              className="min-h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
            >
              <option value="all">Any value</option>
              {COST_BANDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="min-h-10 w-full rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700"
            >
              Apply filters
            </button>
          </div>
        </form>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-900 bg-red-950/30 p-5 text-sm text-red-300">
          Unable to load procurement events. Please try again later.
        </div>
      ) : (
        <section className="table-scroll">
          <table className="intel-table">
            <caption className="sr-only">Procurement events</caption>
            <thead className="border-b border-slate-800 bg-slate-950">
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Country</th>
                <th scope="col">Event</th>
                <th scope="col">Branch</th>
                <th scope="col">Type</th>
                <th scope="col" className="text-right">Value</th>
                <th scope="col">Importance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rowsShown.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-sm text-slate-500">{formatDateHuman(row.event_date)}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{row.country_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {row.contract_id ? (
                      <Link
                        href={`/contracts/${row.contract_id}`}
                        className="text-sm font-medium text-slate-200 hover:text-sky-300 hover:underline"
                      >
                        {row.title ?? `Event ${row.id}`}
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-200">{row.title ?? `Event ${row.id}`}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{formatLabel(row.branch)}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{formatLabel(row.event_type)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-slate-400">
                    {formatUsd(row.value_usd)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{formatLabel(row.importance)}</td>
                </tr>
              ))}
              {rowsShown.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                    No procurement events match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {hiddenCount > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              Showing the {PAGE_SIZE.toLocaleString()} most recent of{" "}
              {rows.length.toLocaleString()} matching events — refine the
              filters to see more.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
