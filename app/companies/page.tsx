import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCountryRegion } from "@/lib/countryRegions";
import { computeEffectiveness, effectivenessBand } from "@/lib/effectiveness";

export default async function CompaniesPage() {
  const supabase = await createClient();

  const [{ data: companies, error }, { data: countries }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, headquarters_country, sector, company_type, data_confidence")
      .order("name"),
    supabase.from("countries").select("id, name, region"),
  ]);

  const rows = companies ?? [];
  const countryByName = new Map((countries ?? []).map((c) => [c.name, c]));

  // Count contracts per company for the "Contracts" column
  const companyIds = rows.map((c) => c.id);
  const { data: contractRows } = companyIds.length
    ? await supabase.from("contracts").select("company_id").in("company_id", companyIds)
    : { data: [] as { company_id: number | null }[] };
  const contractsByCompany = new Map<number, number>();
  for (const row of contractRows ?? []) {
    if (row.company_id == null) continue;
    contractsByCompany.set(row.company_id, (contractsByCompany.get(row.company_id) ?? 0) + 1);
  }

  /* Effectiveness index per company (on-time, on-budget across assessable contracts). */
  const { data: assessableRows } = companyIds.length
    ? await supabase
        .from("contracts")
        .select("company_id, planned_end_date, actual_end_date, planned_value_usd, actual_value_usd")
        .in("company_id", companyIds)
    : { data: [] as never[] };
  const effectivenessByCompany = new Map<number, ReturnType<typeof computeEffectiveness>>();
  const contractsByCompanyRaw = new Map<number, { planned_end_date: string | null; actual_end_date: string | null; planned_value_usd: number | null; actual_value_usd: number | null }[]>();
  for (const row of (assessableRows ?? []) as { company_id: number | null; planned_end_date: string | null; actual_end_date: string | null; planned_value_usd: number | null; actual_value_usd: number | null }[]) {
    if (row.company_id == null) continue;
    const list = contractsByCompanyRaw.get(row.company_id) ?? [];
    list.push({ planned_end_date: row.planned_end_date, actual_end_date: row.actual_end_date, planned_value_usd: row.planned_value_usd, actual_value_usd: row.actual_value_usd });
    contractsByCompanyRaw.set(row.company_id, list);
  }
  for (const [companyId, list] of contractsByCompanyRaw) {
    effectivenessByCompany.set(companyId, computeEffectiveness(list));
  }

  const getRegion = (hqCountry: string | null) => {
    const match = hqCountry ? countryByName.get(hqCountry) : undefined;
    return getCountryRegion({ name: hqCountry, region: match?.region ?? null });
  };

  const regions = Array.from(new Set(rows.map((c) => getRegion(c.headquarters_country)))).sort();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Industrial Base</h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Defence Contractors & Strategic Suppliers
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">
          {error.message}
        </div>
      )}

      <div className="space-y-8">
        {regions.map(region => (
          <div key={region} className="space-y-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 border-l-2 border-blue-600 pl-2">
              {region}
            </h2>
            <div className="rounded border border-slate-800 bg-slate-900/50 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-900/80 border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Company</th>
                    <th className="px-3 py-2 font-semibold">HQ Country</th>
                    <th className="px-3 py-2 font-semibold text-right">Contracts</th>
                    <th className="px-3 py-2 font-semibold">Effectiveness</th>
                    <th className="px-3 py-2 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs">
                  {rows
                    .filter(company => getRegion(company.headquarters_country) === region)
                    .map((company) => (
                      <tr key={company.id} className="hover:bg-slate-800/40 transition-colors group">
                        <td className="px-3 py-2 font-medium">
                          <Link href={`/companies/${company.id}`} className="text-slate-200 group-hover:text-blue-400 transition-colors">
                            {company.name}
                          </Link>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {[company.sector, company.company_type].filter(Boolean).join(" • ") || "Sector not recorded"}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-500 font-mono uppercase">{company.headquarters_country || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-400">{contractsByCompany.get(company.id) ?? 0}</td>
                        <td className="px-3 py-2">
                          {(() => {
                            const eff = effectivenessByCompany.get(company.id);
                            const band = effectivenessBand(eff?.score ?? null);
                            return (
                              <span
                                title={
                                  eff?.score === null || !eff
                                    ? "No assessable contracts (planned and actual dates/value) recorded."
                                    : `Score ${eff.score}/100 · ${eff.onTime} on time, ${eff.onBudget} on budget across ${eff.assessed} assessable contracts.`
                                }
                                className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${band.badgeClass}`}
                              >
                                {eff?.score === null || !eff ? "n/a" : `${eff.score}/100`}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Link
                            href={`/companies/${company.id}`}
                            className="text-xs text-blue-500 hover:text-blue-400 transition-colors font-medium"
                          >
                            View Profile &rarr;
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
            No companies are currently tracked in the database.
          </div>
        )}
      </div>
    </div>
  );
}
