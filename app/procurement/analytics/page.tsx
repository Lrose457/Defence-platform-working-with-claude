import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Summary = {
  total_contracts: number | null;
  valued_contracts: number | null;
  total_contract_value: number | null;
  total_procurement_events: number | null;
  high_importance_events: number | null;
  countries_with_activity: number | null;
  companies_with_activity: number | null;
  latest_event_date: string | null;
};

type CountryRow = {
  country_id: number;
  country_name: string;
  contract_count: number;
  valued_contract_count: number;
  total_contract_value: number;
  procurement_event_count: number;
  high_importance_event_count: number;
  supplier_count: number;
  programme_count: number;
  latest_procurement_date: string | null;
};

type YearRow = {
  year: number;
  procurement_event_count: number;
  contract_event_count: number;
  high_importance_event_count: number;
  country_count: number;
  company_count: number;
  programme_count: number;
};

function formatMoney(value: number | null) {
  if (!value) return "—";

  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}bn`;
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}m`;
  }

  return `$${value.toLocaleString()}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ProcurementAnalyticsPage() {
  const supabase = await createClient();

  const [
    summaryResult,
    countriesResult,
    yearlyResult,
  ] = await Promise.all([
    supabase
      .from("procurement_analytics_summary")
      .select("*")
      .single(),

    supabase
      .from("procurement_country_analytics")
      .select("*")
      .order("total_contract_value", {
        ascending: false,
      })
      .limit(100),

    supabase
      .from("procurement_yearly_analytics")
      .select("*")
      .order("year", {
        ascending: false,
      }),
  ]);

  const summary = summaryResult.data as Summary | null;
  const countries =
    (countriesResult.data || []) as CountryRow[];
  const years =
    (yearlyResult.data || []) as YearRow[];

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-7 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/procurement"
          className="text-xs font-medium text-slate-500 hover:text-cyan-300"
        >
          ← Procurement
        </Link>

        <header className="mt-5 mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Procurement intelligence
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Procurement analytics
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Analyse procurement activity across countries, companies and
            programmes using the procurement records currently held in the
            platform.
          </p>
        </header>

        <section
          aria-label="Procurement metrics"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {[
            ["Contracts", summary?.total_contracts ?? 0],
            ["Procurement events", summary?.total_procurement_events ?? 0],
            ["Contract value", formatMoney(summary?.total_contract_value ?? 0)],
            ["High importance", summary?.high_importance_events ?? 0],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-slate-800 bg-[#071225] p-5"
            >
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                {label}
              </div>

              <div className="mt-3 text-3xl font-semibold text-white">
                {value}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-[#071225] p-5 sm:p-7">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">
              Country activity
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Countries ranked by recorded contract value.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <caption className="sr-only">
                Procurement activity by country
              </caption>

              <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-3">Country</th>
                  <th scope="col" className="px-3 py-3">Contracts</th>
                  <th scope="col" className="px-3 py-3">Value</th>
                  <th scope="col" className="px-3 py-3">Events</th>
                  <th scope="col" className="px-3 py-3">Suppliers</th>
                  <th scope="col" className="px-3 py-3">Latest</th>
                </tr>
              </thead>

              <tbody>
                {countries.map((row) => (
                  <tr
                    key={row.country_id}
                    className="border-b border-slate-800/70 last:border-0"
                  >
                    <td className="px-3 py-4">
                      <Link
                        href={`/countries/${row.country_id}`}
                        className="font-medium text-slate-200 hover:text-cyan-300"
                      >
                        {row.country_name}
                      </Link>
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {row.contract_count}
                    </td>

                    <td className="px-3 py-4 font-medium text-slate-200">
                      {formatMoney(row.total_contract_value)}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {row.procurement_event_count}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {row.supplier_count}
                    </td>

                    <td className="px-3 py-4 text-slate-500">
                      {formatDate(row.latest_procurement_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-[#071225] p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-white">
            Yearly procurement activity
          </h2>

          <p className="mt-1 mb-5 text-sm text-slate-500">
            Recorded procurement events by calendar year.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-175 text-left text-sm">
              <caption className="sr-only">
                Yearly procurement activity
              </caption>

              <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-3">Year</th>
                  <th scope="col" className="px-3 py-3">Events</th>
                  <th scope="col" className="px-3 py-3">Contracts</th>
                  <th scope="col" className="px-3 py-3">High importance</th>
                  <th scope="col" className="px-3 py-3">Countries</th>
                  <th scope="col" className="px-3 py-3">Companies</th>
                </tr>
              </thead>

              <tbody>
                {years.map((row) => (
                  <tr
                    key={row.year}
                    className="border-b border-slate-800/70 last:border-0"
                  >
                    <td className="px-3 py-4 font-semibold text-white">
                      {row.year}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {row.procurement_event_count}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {row.contract_event_count}
                    </td>

                    <td className="px-3 py-4 text-amber-300">
                      {row.high_importance_event_count}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {row.country_count}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {row.company_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}