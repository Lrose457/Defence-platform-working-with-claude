import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { companies as catalogueCompanies } from "@/lib/data";
import { fetchUsaSpendingContracts } from "@/lib/usaSpending";
import { provenanceToneClass, scoreSourceProvenance } from "@/lib/provenance";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const companyFilter = params.company as string;
  const countryFilter = params.country as string;

  const supabase = await createClient();

  let query = supabase
    .from("contracts")
    .select(`
      *,
      companies!inner (
        id,
        name
      ),
      sources!left (
        id,
        title,
        publisher,
        source_type,
        reliability,
        verification_status,
        last_verified_at,
        url,
        notes
      )
    `)
    .order("created_at", { ascending: false });

  if (companyFilter) {
    query = query.eq("company_id", Number(companyFilter));
  }

  if (countryFilter) {
    query = query.eq("country_id", Number(countryFilter));
  }

  const { data: contracts, error } = await query;
  const companyIds = Array.from(
    new Set((contracts ?? []).map((contract) => contract.company_id).filter(Boolean)),
  );
  const { data: companyRows } = companyIds.length
    ? await supabase.from("companies").select("id, name").in("id", companyIds)
    : { data: [] };
  const companyNames = new Map(
    (companyRows ?? []).map((company) => [Number(company.id), company.name]),
  );
  const federalAwardGroups = await Promise.all(
    catalogueCompanies.map(async (company) => ({
      company,
      awards: await fetchUsaSpendingContracts(company.id, 100).catch(() => []),
    })),
  );
  const federalAwards = federalAwardGroups.flatMap(({ company, awards }) =>
    awards.map((award) => ({ ...award, company })),
  );

  // Fetch country names separately to avoid ambiguous relationship embedding
  const countryIds = Array.from(new Set((contracts ?? []).map((c) => c.country_id).filter(Boolean)));
  let countriesMap: Record<number, string> = {};

  if (countryIds.length > 0) {
    const { data: countriesData } = await supabase
      .from("countries")
      .select("id, name")
      .in("id", countryIds);

    countriesMap = (countriesData ?? []).reduce((acc, country) => {
      acc[Number(country.id)] = country.name;
      return acc;
    }, {} as Record<number, string>);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold">Contracts</h1>
          <p className="mt-2 text-slate-400">
            Defence procurement contracts.
            {(companyFilter || countryFilter) && (
              <span className="ml-2 text-blue-400">
                Filtering active...
              </span>
            )}
          </p>
        </div>
        {(companyFilter || countryFilter) && (
          <Link
            href="/contracts"
            className="text-sm bg-slate-800 px-3 py-1 rounded hover:bg-slate-700"
          >
            Clear Filters
          </Link>
        )}
      </div>

      {error && (
        <div className="rounded border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">
          {error.message}
        </div>
      )}

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <table className="w-full">
          <thead className="text-left border-b border-slate-800">
            <tr>
              <th className="pb-3">Contract</th>
              <th className="pb-3">Company</th>
              <th className="pb-3">Source</th>
              <th className="pb-3">Country</th>
              <th className="pb-3">Value</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Confidence</th>
              <th className="pb-3">Provenance</th>
              <th className="pb-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {(contracts ?? []).map((contract) => (
              (() => {
                const linkedCompany = Array.isArray(contract.companies)
                  ? contract.companies[0]
                  : contract.companies;
                const companyName = linkedCompany?.name || companyNames.get(Number(contract.company_id));
                const source = Array.isArray(contract.sources) ? contract.sources[0] : contract.sources;
                const emptyProvenance = {
                  score: 0,
                  coverage: "missing" as const,
                  checks: {
                    title: false,
                    publisher: false,
                    url: false,
                    sourceType: false,
                    reliability: false,
                    notes: false,
                  },
                };
                const provenance = source
                  ? scoreSourceProvenance({
                      title: source.title,
                      publisher: source.publisher,
                      url: source.url,
                      source_type: source.source_type,
                      reliability: source.reliability,
                      notes: source.notes,
                    })
                  : emptyProvenance;

                return (
              <tr key={contract.id} className="hover:bg-slate-800/50 transition-colors align-top">
                <td className="py-4 font-medium">
                  <Link
                    href={`/contracts/${contract.id}`}
                    className="text-slate-200 hover:text-blue-400 transition-colors"
                  >
                    {contract.title || 'Unknown'}
                  </Link>
                </td>
                <td className="py-4">
                  {companyName ? (
                    <Link
                      href={`/companies/${linkedCompany?.id || contract.company_id}`}
                      className="text-blue-400 hover:underline"
                    >
                      {companyName}
                    </Link>
                  ) : (
                    <span className="text-slate-500">Unknown</span>
                  )}
                </td>
                <td className="py-4 text-sm text-slate-300">
                  {source ? (
                    <div>
                      <Link href={`/sources/${source.id}`} className="text-blue-400 hover:underline">
                        {source.title}
                      </Link>
                      {source.verification_status && (
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                          {source.verification_status}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-500">No source</span>
                  )}
                </td>
                <td className="py-4 text-sm text-slate-400">
                  {contract.country_id ? (countriesMap[Number(contract.country_id)] || 'Unknown') : 'Unknown'}
                </td>
                <td className="py-4 font-mono text-green-400">{contract.value || 'N/A'}</td>
                <td className="py-4">
                  <span className={`text-xs px-2 py-1 rounded ${
                    contract.status === 'Funded' ? 'bg-green-900 text-green-300' :
                    contract.status === 'Passed' ? 'bg-blue-900 text-blue-300' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {contract.status || 'Unknown'}
                  </span>
                </td>
                <td className="py-4">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className={`text-xs ${i < (contract.confidence_score || 0) ? 'text-yellow-500' : 'text-slate-700'}`}>
                        ★
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-4">
                  {source ? (
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${provenanceToneClass(provenance.coverage)}`}>
                        {provenance.coverage}
                      </span>
                      <span className="text-xs text-slate-300">{provenance.score}%</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">N/A</span>
                  )}
                </td>
                <td className="py-4 text-slate-500 text-sm">{contract.created_at ? new Date(contract.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</td>
              </tr>
                );
              })()
            ))}
          </tbody>
        </table>

        {(contracts?.length === 0) && (
          <div className="p-6 text-center text-sm text-slate-400">
            No contracts found.
          </div>
        )}
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Verified federal defence awards</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            These records are shown because USAspending matched the recipient to a site company and the awarding agency or description indicates a defence connection. Non-defence records are excluded. Quantity, unit price, export destination, and exact equipment are shown as not disclosed when USAspending does not publish them.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["What was bought", "USAspending description, FPDS award detail, DoD announcements"],
            ["How many / unit cost", "Contract line-item data, procurement notices, budget justification books"],
            ["Where sold or exported", "DSCA FMS notifications, export licences, recipient-country procurement records"],
            ["Why important", "DoD programme records, capability documents, service budget and congressional records"],
          ].map(([label, datasets]) => (
            <div key={label} className="rounded border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">{label}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{datasets}</p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900 p-4">
          <table className="min-w-312.5 w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-3">Award</th>
                <th className="px-3 py-3">Named item</th>
                <th className="px-3 py-3">Company</th>
                <th className="px-3 py-3">Why here / importance</th>
                <th className="px-3 py-3">Value</th>
                <th className="px-3 py-3">Quantity / unit cost</th>
                <th className="px-3 py-3">Destination</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {federalAwards.map((award) => (
                <tr key={`${award.company.id}-${award.awardId}-${award.internalId ?? "record"}`} className="align-top hover:bg-slate-800/30">
                  <td className="px-3 py-3 font-mono text-blue-400">{award.awardId}</td>
                  <td className="px-3 py-3 text-slate-300"><strong>{award.itemName || "Item name not disclosed"}</strong><div className="mt-1 text-[11px] text-slate-500">Category: {award.itemType || "Not classified"}</div></td>
                  <td className="px-3 py-3 text-slate-300">{award.company.name}<div className="mt-1 text-[11px] text-slate-500">{award.recipientName}</div></td>
                  <td className="max-w-xs px-3 py-3 text-slate-400"><strong className="text-slate-300">{award.importance}</strong><div className="mt-1">{award.whyIncluded}</div></td>
                  <td className="px-3 py-3 whitespace-nowrap font-mono text-green-400">{award.amount === null ? "Not disclosed" : `$${award.amount.toLocaleString()}`}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-slate-500">{award.quantity === null ? "Quantity not disclosed" : award.quantity.toLocaleString()}<div>{award.unitCostUsd === null ? "Unit cost not disclosed" : `$${award.unitCostUsd.toLocaleString()}`}</div></td>
                  <td className="px-3 py-3 text-slate-500">{award.destination || "Export/sale destination not disclosed"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {federalAwards.length === 0 && <p className="p-5 text-sm text-slate-500">No live federal awards could be loaded.</p>}
        </div>
        <p className="text-xs text-slate-600">Source: USAspending public federal award records. Federal awards are not automatically exports; a US agency award may be domestic production, sustainment, research, or logistics.</p>
      </section>
    </div>
  );
}