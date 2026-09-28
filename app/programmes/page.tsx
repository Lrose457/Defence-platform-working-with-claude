import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ProgrammesPage() {
  const supabase = await createClient();

  const [{ data: programmes }, { data: partners }] = await Promise.all([
    supabase
      .from("programme_intelligence_summary")
      .select("*")
      .order("programme_name"),
    supabase
      .from("programme_partners_overview")
      .select("programme_id, lead_country_id, partner_countries, country_ids, partner_count, is_joint"),
  ]);

  type PartnerRow = {
    programme_id: number;
    lead_country_id: number | null;
    partner_countries: string[] | null;
    country_ids: number[] | null;
    partner_count: number | null;
    is_joint: boolean | null;
  };

  const partnersById = new Map(
    ((partners ?? []) as PartnerRow[]).map((p) => [p.programme_id, p]),
  );

  const rows = programmes || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Defence Programmes</h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Programme-level Intelligence & Procurement Coordination
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Programmes', value: rows.length },
          { label: 'With Contracts', value: rows.filter((p) => Number(p.contract_count) > 0).length },
          { label: 'Procurement Events', value: rows.reduce((sum, p) => sum + Number(p.procurement_event_count || 0), 0) },
          { label: 'Intelligence Changes', value: rows.reduce((sum, p) => sum + Number(p.intelligence_change_count || 0), 0) },
        ].map((stat) => (
          <div key={stat.label} className="p-3 rounded border border-slate-800 bg-slate-900/50">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">{stat.label}</p>
            <p className="text-2xl font-mono font-bold text-white mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded border border-slate-800 bg-slate-900/50 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
            <tr className="border-b border-slate-800">
              <th className="px-3 py-2 font-semibold">Programme Name</th>
              <th className="px-3 py-2 font-semibold">Country</th>
              <th className="px-3 py-2 font-semibold text-right">Status</th>
              <th className="px-3 py-2 font-semibold text-right">Contracts</th>
              <th className="px-3 py-2 font-semibold text-right">Procurement</th>
              <th className="px-3 py-2 font-semibold text-right">Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-xs">
            {rows.map((programme) => {
              const partnerRow = partnersById.get(programme.programme_id);
              const partnerEntries = (partnerRow?.partner_countries ?? [])
                .map((name, i) => ({ name, id: partnerRow?.country_ids?.[i] ?? null }))
                .filter((e) => e.id !== partnerRow?.lead_country_id);
              return (
              <tr
                key={programme.programme_id}
                className="hover:bg-slate-800/40 transition-colors group"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/programmes/${programme.programme_id}`}
                    className="font-medium text-slate-200 group-hover:text-blue-400 transition-colors"
                  >
                    {programme.programme_name}
                  </Link>
                  {partnerRow?.is_joint && (
                    <span
                      className="ml-2 rounded border border-cyan-800 bg-cyan-950/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-300"
                      title={`${partnerRow.partner_count ?? 0} participating countries`}
                    >
                      Joint
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-500 font-mono uppercase">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {programme.country_name || "—"}
                    {partnerEntries.map((e) =>
                      e.id != null ? (
                        <Link
                          key={e.id}
                          href={`/countries/${e.id}`}
                          className="text-slate-400 hover:text-blue-400"
                        >
                          {e.name}
                        </Link>
                      ) : (
                        <span key={e.name}>{e.name}</span>
                      ),
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">{programme.status || "Not recorded"}</span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-400">
                  {programme.contract_count || 0}
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-400">
                  {programme.procurement_event_count || 0}
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-400">
                  {programme.intelligence_change_count || 0}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-6 text-center text-xs text-slate-500 font-mono">
            NO_PROGRAMMES_FOUND_IN_SITEMAP
          </div>
        )}
      </div>
    </div>
  );
}
