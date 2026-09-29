import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Country = {
  country_id: number;
  country_name: string;
  iso_code: string | null;
  region: string | null;
  latest_budget_year: number | null;
  latest_nominal_spending: number | null;
  latest_real_spending: number | null;
  latest_gdp_burden: number | null;
  latest_government_burden: number | null;
  previous_nominal_spending: number | null;
  previous_real_spending: number | null;
  equipment_systems: number;
  equipment_quantity: number;
  contract_count: number;
  contract_value: number;
  procurement_event_count: number;
};

function money(value: number | null) {
  if (!value) return "—";

  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}bn`;
  }

  return `$${(value / 1_000_000).toFixed(0)}m`;
}

function percent(value: number | null) {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

function yoy(
  current: number | null,
  previous: number | null,
) {
  if (
    current == null ||
    previous == null ||
    previous === 0
  ) {
    return "—";
  }

  const change = ((current - previous) / previous) * 100;

  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
}

export default async function CountryBenchmarkPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("country_benchmark_summary")
    .select("*")
    .order("latest_nominal_spending", {
      ascending: false,
      nullsFirst: false,
    });

  const countries = (data || []) as Country[];

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-7 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/compare"
          className="text-xs text-slate-500 hover:text-cyan-300"
        >
          ← Compare
        </Link>

        <header className="mt-5 mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Benchmarking
          </p>

          <h1 className="mt-2 text-3xl font-semibold text-white">
            Country benchmark
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Compare the latest available defence spending, burden,
            procurement and equipment indicators across countries.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-300">
            {error.message}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-[#071225] p-5 sm:p-7">
          <div className="overflow-x-auto">
            <table className="w-full min-w-300 text-left text-sm">
              <caption className="sr-only">
                Country defence benchmark comparison
              </caption>

              <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-3">Country</th>
                  <th scope="col" className="px-3 py-3">Spending</th>
                  <th scope="col" className="px-3 py-3">YoY</th>
                  <th scope="col" className="px-3 py-3">GDP burden</th>
                  <th scope="col" className="px-3 py-3">Gov burden</th>
                  <th scope="col" className="px-3 py-3">Equipment</th>
                  <th scope="col" className="px-3 py-3">Contracts</th>
                  <th scope="col" className="px-3 py-3">Procurement</th>
                </tr>
              </thead>

              <tbody>
                {countries.map((country) => (
                  <tr
                    key={country.country_id}
                    className="border-b border-slate-800/70 last:border-0"
                  >
                    <td className="px-3 py-4">
                      <Link
                        href={`/countries/${country.country_id}`}
                        className="font-semibold text-slate-200 hover:text-cyan-300"
                      >
                        {country.country_name}
                      </Link>

                      {country.region && (
                        <div className="mt-1 text-xs text-slate-600">
                          {country.region}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-4 font-medium text-white">
                      {money(country.latest_nominal_spending)}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {yoy(
                        country.latest_nominal_spending,
                        country.previous_nominal_spending,
                      )}
                    </td>

                    <td className="px-3 py-4 text-cyan-300">
                      {percent(country.latest_gdp_burden)}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {percent(country.latest_government_burden)}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {country.equipment_systems}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {country.contract_count}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {country.procurement_event_count}
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