import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCountryRegion } from "@/lib/countryRegions";

export default async function CountriesPage() {
  const supabase = await createClient();

  const [{ data: countries, error }, { data: budgets, error: budgetsError }] =
    await Promise.all([
      supabase
        .from("countries")
        .select("id, name, iso_code, region")
        .order("name"),
      supabase
        .from("budgets")
        .select("country_id, year, amount_usd, is_estimate")
        .order("year", { ascending: false }),
    ]);

  const rows = countries ?? [];
  const latestBudgetByCountry = new Map<number, {
    year: number;
    amount_usd: number | null;
    is_estimate: boolean | null;
  }>();

  for (const budget of budgets ?? []) {
    if (!latestBudgetByCountry.has(Number(budget.country_id))) {
      latestBudgetByCountry.set(Number(budget.country_id), budget);
    }
  }

  const regions = Array.from(
    new Set(rows.map((country) => getCountryRegion(country))),
  ).sort();

  function formatBudget(countryId: number) {
    const budget = latestBudgetByCountry.get(Number(countryId));

    if (!budget || budget.amount_usd === null) {
      return "Not recorded";
    }

    const amount = budget.amount_usd;
    const value = amount >= 1_000_000_000
      ? `$${(amount / 1_000_000_000).toFixed(1)}bn`
      : `$${(amount / 1_000_000).toFixed(0)}m`;

    return `${value} (${budget.year}${budget.is_estimate ? " est." : ""})`;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Global defence countries
          </h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            National coverage across the platform
          </p>
        </div>

        <Link
          href="/countries/map"
          className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors uppercase tracking-tighter"
        >
          Open global map
        </Link>
      </div>

      {(error || budgetsError) && (
        <div className="rounded border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">
          {error?.message || budgetsError?.message}
        </div>
      )}

      <div className="space-y-8">
        {regions.map((region) => (
          <div key={region} className="space-y-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 border-l-2 border-blue-600 pl-2">
              {region}
            </h2>

            <div className="rounded border border-slate-800 bg-slate-900/50 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-900/80 border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Country</th>
                    <th className="px-3 py-2 font-semibold">ISO</th>
                    <th className="px-3 py-2 font-semibold">Latest budget</th>
                    <th className="px-3 py-2 font-semibold text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800 text-xs">
                  {rows
                    .filter((country) => getCountryRegion(country) === region)
                    .map((country) => (
                      <tr
                        key={country.id}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        <td className="px-3 py-2 font-medium">
                          <Link
                            href={`/countries/${country.id}`}
                            className="text-slate-200 group-hover:text-blue-400 transition-colors"
                          >
                            {country.name || "Unnamed country"}
                          </Link>
                        </td>

                        <td className="px-3 py-2 text-slate-500 font-mono">
                          {country.iso_code || "—"}
                        </td>

                        <td className="px-3 py-2 text-slate-300 font-mono">
                          {formatBudget(country.id)}
                        </td>

                        <td className="px-3 py-2 text-right">
                          <Link
                            href={`/contracts?country=${country.id}`}
                            className="text-xs text-blue-500 hover:text-blue-400 transition-colors font-medium"
                          >
                            View pipeline →
                          </Link>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
            No countries are currently available in the database.
          </div>
        )}
      </div>
    </div>
  );
}
