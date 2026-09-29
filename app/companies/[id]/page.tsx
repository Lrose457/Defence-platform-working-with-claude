import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchUsaSpendingContracts } from "@/lib/usaSpending";
import { computeEffectiveness } from "@/lib/effectiveness";
import EffectivenessBadge from "@/components/EffectivenessBadge";
import RevolvingDoorPanel from "@/components/RevolvingDoorPanel";

export default async function CompanyProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Supabase uses numeric ids; legacy demo data used "comp-N" string ids.
  const { id: rawId } = await params;
  const numericId = Number(rawId);
  const legacyNumericId = rawId.startsWith("comp-") ? Number(rawId.slice(5)) : NaN;
  const companyId = Number.isFinite(numericId)
    ? numericId
    : Number.isFinite(legacyNumericId)
      ? legacyNumericId
      : null;

  const supabase = await createClient();

  let company: {
    id: number;
    name: string | null;
    headquarters_country: string | null;
    sector: string | null;
    company_type: string | null;
    description: string | null;
    data_confidence: string | null;
    website: string | null;
    website_url: string | null;
  } | null = null;

  if (companyId !== null) {
    const { data } = await supabase
      .from("companies")
      .select("id, name, headquarters_country, sector, company_type, description, data_confidence, website, website_url")
      .eq("id", companyId)
      .maybeSingle();
    company = data;
  }

  if (!company) return notFound();

  const [{ data: companyContracts }, { data: equipByManufacturer }, { data: tenures }] = await Promise.all([
    supabase
      .from("contracts")
      .select("id, title, value, value_usd, status, contract_date, data_confidence, planned_end_date, actual_end_date, planned_value_usd, actual_value_usd")
      .eq("company_id", company.id)
      .order("contract_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("equipment")
      .select("id, name, manufacturer, category_id, confidence")
      .ilike("manufacturer", `%${company.name ?? ""}%`)
      .limit(20),
    supabase
      .from("revolving_door_overview")
      .select("id, person_name, person_id, former_role, former_organisation, industry_role, started_on, ended_on, source_name, source_url, evidence_level")
      .eq("company_id", company.id)
      .order("started_on", { ascending: false, nullsFirst: false }),
  ]);

  const contracts = companyContracts ?? [];
  const equipment = equipByManufacturer ?? [];
  // USAspending matching previously keyed off demo "comp-N" ids; skip when unknown.
  const publicContracts = Number.isFinite(numericId) || rawId.startsWith("comp-")
    ? await fetchUsaSpendingContracts(rawId).catch(() => [])
    : [];

  /*
   * Effectiveness index (doc criteria: on time, on budget). Only contracts
   * with both planned and actual figures are assessable; the rest are
   * excluded rather than scored as failures.
   */
  const effectiveness = computeEffectiveness(
    (contracts ?? []).map((c) => ({
      planned_end_date: (c as { planned_end_date?: string | null }).planned_end_date ?? null,
      actual_end_date: (c as { actual_end_date?: string | null }).actual_end_date ?? null,
      planned_value_usd: (c as { planned_value_usd?: number | null }).planned_value_usd ?? null,
      actual_value_usd: (c as { actual_value_usd?: number | null }).actual_value_usd ?? null,
    })),
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <Link href="/companies" className="text-[10px] font-bold uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors">
            &larr; Industrial Index
          </Link>
          <h1 className="text-4xl font-bold tracking-tight text-white">{company.name}</h1>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">
            Corporate Intelligence Dossier // {(company.headquarters_country || "Unknown").toUpperCase()}
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex flex-col items-end gap-2">
          <div className="text-right bg-slate-900 border border-slate-800 p-3 rounded">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Data Confidence</p>
            <p className="text-2xl font-mono text-green-400 font-bold">{company.data_confidence || "Not recorded"}</p>
            <p className="text-[10px] font-mono text-slate-500 mt-1">Status: TRACKED ENTITY</p>
          </div>
        </div>
        </div>
      </div>

      {company.description && (
        <div className="p-4 rounded border-l-4 border-blue-600 bg-blue-900/10 space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Profile</h2>
          <p className="text-sm text-slate-300 leading-relaxed italic">
            {company.description}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Headquarters', value: company.headquarters_country || "Not recorded" },
          { label: 'Sector / Type', value: [company.sector, company.company_type].filter(Boolean).join(" • ") || "Not recorded" },
          { label: 'Contract Volume', value: contracts.length.toString() },
        ].map((stat, i) => (
          <div key={i} className="p-3 rounded border border-slate-800 bg-slate-900/50">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">{stat.label}</p>
            <p className="text-lg font-medium text-slate-200">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <EffectivenessBadge {...effectiveness} />
        <span className="text-[10px] text-slate-600">
          Criteria: on-time and on-budget delivery of assessable contracts.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">Contractual Portfolio</h2>
            <span className="text-[10px] font-mono text-slate-500">{contracts.length} ACTIVE ENGAGEMENTS</span>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900/50 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2 font-semibold">Contract Title</th>
                  <th className="px-3 py-2 font-semibold text-right">Value</th>
                  <th className="px-3 py-2 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {contracts.map((contract) => (
                  <tr key={contract.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-3 py-2">
                      <Link href={`/contracts/${contract.id}`} className="font-medium text-slate-200 hover:text-blue-400">
                        {contract.title || `Contract ${contract.id}`}
                      </Link>
                      <p className="text-[10px] text-slate-500 font-mono">Conf: {contract.data_confidence || "Not recorded"}</p>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-green-400">
                      {(contract.value_usd ?? contract.value) == null
                        ? "Not disclosed"
                        : `$${Number(contract.value_usd ?? contract.value).toLocaleString()}`}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-[10px] font-mono text-slate-400">{contract.status || "—"}</span>
                    </td>
                  </tr>
                ))}
                {contracts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-slate-500">
                      No tracked contracts linked to this company yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">Product Portfolio</h2>
            <span className="text-[10px] font-mono text-slate-500">{equipment.length} ASSETS PRODUCED</span>
          </div>
          <div className="grid gap-3">
            {equipment.map((item) => (
              <div key={item.id} className="p-3 rounded border border-slate-800 bg-slate-900/50 flex justify-between items-center">
                <div className="space-y-1">
                  <Link href={`/equipment/${item.id}`} className="font-bold text-slate-200 hover:text-blue-400">
                    {item.name || `Equipment ${item.id}`}
                  </Link>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {item.manufacturer || "Manufacturer not recorded"}
                  </p>
                </div>
                <span className="text-[10px] font-mono text-slate-500">CONF: {item.confidence || "Not recorded"}</span>
              </div>
            ))}
            {equipment.length === 0 && (
              <p className="p-4 text-sm text-slate-500 rounded border border-slate-800 bg-slate-900/50">
                No equipment currently linked to this company.
              </p>
            )}
          </div>
        </div>
      </div>

      <RevolvingDoorPanel tenures={(tenures ?? []) as never[]} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">Public federal awards</h2>
            <p className="mt-1 text-xs text-slate-500">
              Live USAspending results matched to this company and ranked by award amount.
            </p>
          </div>
          <a href="https://www.usaspending.gov/" target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300">
            Source: USAspending ↗
          </a>
        </div>
        <div className="overflow-x-auto rounded border border-slate-800 bg-slate-900/50">
          <table className="w-full min-w-190 text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Award</th>
                <th className="px-3 py-2">Recipient</th>
                <th className="px-3 py-2">Agency</th>
                <th className="px-3 py-2">Why / importance</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Item / production</th>
                <th className="px-3 py-2">Sale or export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {publicContracts.map((contract) => (
                <tr key={`${contract.awardId}-${contract.internalId ?? "award"}`} className="hover:bg-slate-800/30">
                  <td className="px-3 py-3 font-mono text-blue-400">{contract.awardId}</td>
                  <td className="px-3 py-3 text-slate-300">{contract.recipientName}</td>
                  <td className="px-3 py-3 text-slate-400">{contract.awardingAgency || "Not recorded"}</td>
                  <td className="max-w-xs px-3 py-3 text-slate-400"><strong className="text-slate-300">{contract.importance}</strong><div className="mt-1 text-[11px]">{contract.whyIncluded}</div></td>
                  <td className="px-3 py-3 text-right font-mono text-green-400">
                    {contract.amount === null ? "Not recorded" : `$${contract.amount.toLocaleString()}`}
                  </td>
                  <td className="px-3 py-3 text-slate-500">
                    {contract.itemName || "Item name not disclosed"}<div className="mt-1 text-[11px]">Category: {contract.itemType || "not classified"}</div><div className="text-[11px]">Quantity: {contract.quantity === null ? "not disclosed" : contract.quantity.toLocaleString()}</div><div className="text-[11px]">Unit cost: {contract.unitCostUsd === null ? "not disclosed" : `$${contract.unitCostUsd.toLocaleString()}`}</div><div className="mt-1 text-[11px]">{contract.startDate || "Unknown"} to {contract.endDate || "Unknown"}</div>
                  </td>
                  <td className="px-3 py-3 text-slate-500">
                    {contract.destination || "Destination not disclosed"}
                    {contract.description && (
                      <p className="mt-1 max-w-xs text-[11px] text-slate-600">{contract.description}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {publicContracts.length === 0 && (
            <p className="p-5 text-sm text-slate-500">No matching USAspending awards were returned for this company.</p>
          )}
        </div>
      </section>
    </div>
  );
}
