import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatUsd, formatDate } from "@/lib/format";

export default async function HomePage() {
  const supabase = await createClient();

  const [
    { count: countryCount },
    { count: companyCount },
    { count: contractCount },
    { count: equipmentCount },
    { data: recentContracts },
  ] = await Promise.all([
    supabase.from("countries").select("id", { count: "exact", head: true }),
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("contracts").select("id", { count: "exact", head: true }),
    supabase.from("equipment").select("id", { count: "exact", head: true }),
    supabase
      .from("contracts")
      .select("id, title, value, value_usd, status, data_confidence, created_at, contract_date")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const stats = [
    { label: "Sovereign States", value: countryCount ?? 0, href: "/countries" },
    { label: "Industrial Primes", value: companyCount ?? 0, href: "/companies" },
    { label: "Active Contracts", value: contractCount ?? 0, href: "/contracts" },
    { label: "Capability Assets", value: equipmentCount ?? 0, href: "/equipment" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Intelligence Terminal</h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Global Defence Procurement & Capabilities Oversight
          </p>
        </div>
        <div className="text-right font-mono">
          <p className="text-[10px] text-slate-500 uppercase">
            Source-attributed records · confidence-labelled
          </p>
          <p className="text-[10px] text-slate-500 uppercase">
            Ingestion pipeline: <span className="text-green-500">reviewed</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="p-3 rounded border border-slate-800 bg-slate-900/50 hover:border-blue-600 transition-all group"
          >
            <p className="text-[10px] uppercase tracking-widest text-slate-500 group-hover:text-slate-300">{stat.label}</p>
            <p className="text-2xl font-mono font-bold text-white mt-1">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">Priority Signal Feed</h2>
            <Link href="/contracts" className="text-[10px] font-mono text-blue-500 hover:underline">VIEW_ALL_PIPELINE &rarr;</Link>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900/50 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <tr className="border-b border-slate-800">
                  <th className="px-3 py-2 font-semibold">Signal</th>
                  <th className="px-3 py-2 font-semibold text-right">Value</th>
                  <th className="px-3 py-2 font-semibold text-right">Status</th>
                  <th className="px-3 py-2 font-semibold text-right">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {(recentContracts ?? []).map((update) => (
                  <tr key={update.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-3 py-2">
                      <Link href={`/contracts/${update.id}`} className="font-medium text-slate-200 hover:text-blue-400">
                        {update.title || `Contract ${update.id}`}
                      </Link>
                      <p className="text-[10px] text-slate-500 font-mono">Conf: {update.data_confidence || "Not recorded"}</p>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-green-400">{formatUsd(update.value_usd ?? update.value)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">{update.status || "—"}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-500">{formatDate(update.contract_date || update.created_at)}</td>
                  </tr>
                ))}
                {(recentContracts ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                      No contracts are currently tracked in the database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">Tactical Navigation</h2>
          <div className="grid gap-2">
            {[
              { title: 'Global Spending Map', href: '/countries/map', desc: 'Geospatial Budget Analysis' },
              { title: 'Contractor Directory', href: '/companies', desc: 'Industrial Base Audit' },
              { title: 'Procurement Pipeline', href: '/contracts', desc: 'Active Acquisition Monitor' },
              { title: 'Capability Inventory', href: '/equipment', desc: 'Asset & Role Mapping' },
              { title: 'War Room', href: '/war-room', desc: 'Tactical Situation Board' },
            ].map((link) => (
              <Link
                key={link.title}
                href={link.href}
                className="p-3 rounded border border-slate-800 bg-slate-900/50 hover:border-blue-600 transition-all group"
              >
                <p className="text-xs font-medium text-slate-200 group-hover:text-blue-400 transition-colors">{link.title}</p>
                <p className="text-[10px] text-slate-500 font-mono">{link.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
