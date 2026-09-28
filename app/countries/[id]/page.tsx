import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCountryRegion } from "@/lib/countryRegions";
import ReadinessStrip from "@/components/inventory/ReadinessStrip";
import BranchSection from "@/components/inventory/BranchSection";
import CarrierAirWingCard from "@/components/inventory/CarrierAirWingCard";
import AIDefenceSection from "@/components/inventory/AIDefenceSection";
import {
  JointProgrammesSection,
  ProjectedSpendingSection,
  CountryConflictsSection,
  MarketsSection,
  ArmySizeSection,
  DomesticContractorsSection,
} from "@/components/country/sectionPlaceholders";
import type { InventoryHolding } from "@/lib/inventory";
import { formatLabel } from "@/lib/format";
import { defenceStockSymbols } from "@/lib/stockSymbols";
import CountryMarketPanel from "@/components/CountryMarketPanel";

export default async function CountryProfile({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mkt?: string }>;
}) {
  const { id } = await params;
  const { mkt } = await searchParams;
  const countryId = Number(id);

  if (!Number.isFinite(countryId)) {
    notFound();
  }

  const supabase = await createClient();

  const { data: country, error } = await supabase
    .from("countries")
    .select("*")
    .eq("id", countryId)
    .maybeSingle();

  if (error || !country) {
    notFound();
  }

  const [contractsResult, budgetsResult, inventoryResult, wingsResult, wingAircraftResult, aiResult, programmesResult, conflictsResult, marketsResult, oobResult, contractorsResult, spaceResult] = await Promise.all([
    supabase
      .from("contracts")
      .select("id, value, status, title")
      .eq("country_id", countryId),

    supabase
      .from("budgets")
      .select("year, amount_usd, is_estimate")
      .eq("country_id", countryId)
      .order("year", { ascending: true })
      .limit(15),

    supabase
      .from("country_equipment_overview")
      .select("*")
      .eq("country_id", countryId),

    supabase
      .from("carrier_air_wing_overview")
      .select("*")
      .eq("country_id", countryId),

    supabase
      .from("carrier_air_wing_aircraft")
      .select("wing_id, equipment_id, quantity"),

    supabase
      .from("ai_defence_project_overview")
      .select("*")
      .eq("country_id", countryId),

    /* Patch 0.2: joint programmes, conflicts, markets, force structure, contractors. */
    supabase
      .from("country_programme_overview")
      .select("id, name, status, partner_countries, country_ids")
      .eq("country_id", countryId)
      .order("name"),

    supabase
      .from("country_conflict_overview")
      .select("conflict_id, name, status, intensity_level, region")
      .eq("country_id", countryId)
      .limit(20),

    supabase
      .from("country_market_overview")
      .select("bloc, relationship, share_percent")
      .eq("country_id", countryId)
      .order("share_percent", { ascending: false, nullsFirst: false }),

    supabase
      .from("country_force_structure_overview")
      .select("branch, unit_type, units, personnel, equipment_id, equipment_name, held_qty, required_qty")
      .eq("country_id", countryId)
      .order("branch"),

    supabase
      .from("country_domestic_contractors_overview")
      .select("id, name, sector, company_type, contract_count")
      .eq("country_id", countryId)
      .order("contract_count", { ascending: false })
      .limit(24),

    supabase
      .from("country_space_overview")
      .select("id, domain, status, summary, evidence_level, source_name, source_url")
      .eq("country_id", countryId)
      .limit(12),
  ]);

  /* Legislation tab (doc: link the legislative pipeline to the profile). */
  const { data: legislation } = await supabase
    .from("legislation_pipeline")
    .select("id, title, stage, expected_date")
    .eq("country_id", countryId)
    .order("expected_date", { ascending: true, nullsFirst: false })
    .limit(6);

  const contracts = contractsResult.data ?? [];
  const latestBudget = budgetsResult.data?.[0] ?? null;
  const holdings = (inventoryResult.data ?? []) as InventoryHolding[];
  const wings = wingsResult.data ?? [];
  const wingAircraft = wingAircraftResult.data ?? [];
  const aiProjects = aiResult.data ?? [];
  const spaceRows = (spaceResult.data ?? []) as {
    id: number;
    domain: string | null;
    status: string | null;
    summary: string | null;
    evidence_level: string | null;
    source_name: string | null;
    source_url: string | null;
  }[];

  /* Country-scoped market panel: tickers listed in this country.
   * lib/stockSymbols.ts keys by ISO-2 code; fall back from ISO-3. */
  const ISO2_BY_ISO3: Record<string, string> = {
    GBR: "GB", USA: "US", AUS: "AU", ITA: "IT", JPN: "JP", FRA: "FR",
    DEU: "DE", CHN: "CN", RUS: "RU", IND: "IN", ISR: "IL", POL: "PL",
    KOR: "KR", VNM: "VN", SWE: "SE", CAN: "CA",
  };
  const iso2 = (
    country.iso_code_2 ??
    ISO2_BY_ISO3[country.iso_code?.toUpperCase() ?? ""] ??
    ""
  ).toLowerCase();
  const symbolSet = new Set(defenceStockSymbols.map((s) => s.symbol));
  const symbols = defenceStockSymbols
    .filter((s) => s.country.toLowerCase() === iso2)
    .map((s) => s.symbol);
  const mktSymbol = mkt && symbolSet.has(mkt) ? mkt : null;

  // If the new inventory views do not exist yet (migration not applied),
  // fall back to the legacy country_equipment join so the page still renders.
  let resolvedHoldings: InventoryHolding[] = holdings;
  if (inventoryResult.error) {
    const legacy = await supabase
      .from("country_equipment")
      .select("country_id, equipment_id")
      .eq("country_id", countryId);
    const ids = (legacy.data ?? []).map((r) => r.equipment_id).filter((v) => v != null);
    if (ids.length > 0) {
      const { data: eq } = await supabase
        .from("equipment")
        .select("id, name, branch, sub_category")
        .in("id", ids);
      const nameById = new Map((eq ?? []).map((e) => [e.id, e]));
      resolvedHoldings = ids.map((equipment_id: number, i: number) => {
        const e = nameById.get(equipment_id);
        return {
          holding_id: -1 * (i + 1),
          country_id: countryId,
          equipment_id,
          equipment_name: (e?.name as string | null) ?? null,
          branch: (e?.branch as string | null) ?? null,
          sub_category: (e?.sub_category as string | null) ?? null,
          category_name: null,
          hull_name: null,
          variant: null,
          quantity: null,
          quantity_type: null,
          year: null,
          operational_qty: null,
          maintenance_qty: null,
          status: "unknown",
          deployment_area: null,
          activity: "undisclosed",
          activity_name: null,
          operator_unit: null,
          notes: null,
          source_id: null,
          conflict_id: null,
          exercise_id: null,
          evidence_level: "unverified",
          last_verified_at: null,
          source_title: null,
          confidence: null,
          data_confidence: null,
        } satisfies InventoryHolding;
      });
    } else {
      resolvedHoldings = [];
    }
  }

  const armyHoldings = resolvedHoldings.filter((h) => h.branch === "army");
  const navyHoldings = resolvedHoldings.filter((h) => h.branch === "navy");
  const airForceHoldings = resolvedHoldings.filter((h) => h.branch === "air_force");

  const aircraftByWing = new Map<number, { equipment_id: number; equipment_name: string | null; quantity: number | null }[]>();
  for (const row of wingAircraft as { wing_id: number; equipment_id: number; quantity: number | null }[]) {
    const list = aircraftByWing.get(row.wing_id) ?? [];
    list.push({ equipment_id: row.equipment_id, equipment_name: null, quantity: row.quantity });
    aircraftByWing.set(row.wing_id, list);
  }
  const wingCards = (wingsResult.error ? [] : wings).map((w) => ({
    wing_id: w.wing_id,
    wing_name: w.wing_name ?? null,
    carrier_hull: w.carrier_hull ?? null,
    carrier_class: w.carrier_class ?? null,
    rated_capacity: w.rated_capacity ?? null,
    current_aircraft_count: w.current_aircraft_count ?? null,
    deployment_area: w.deployment_area ?? null,
    activity: w.activity ?? null,
    activity_name: w.activity_name ?? null,
    evidence_level: w.evidence_level ?? null,
    aircraft: aircraftByWing.get(w.wing_id) ?? [],
  }));
  const aiCards = (aiResult.error ? [] : aiProjects).map((p) => ({
    id: p.id,
    programme_name: p.programme_name ?? null,
    domain: p.domain ?? null,
    status: p.status ?? null,
    lead_agency: p.lead_agency ?? null,
    company_id: p.company_id ?? null,
    company_name: p.company_name ?? null,
    programme_id: p.programme_id ?? null,
    programme_link_name: p.programme_link_name ?? null,
    contract_id: p.contract_id ?? null,
    contract_title: p.contract_title ?? null,
    description: p.description ?? null,
    evidence_level: p.evidence_level ?? null,
    source_title: p.source_title ?? null,
  }));

  function formatBudget() {
    if (!latestBudget || latestBudget.amount_usd === null) {
      return "Not recorded";
    }

    const amount = latestBudget.amount_usd;
    const value = amount >= 1_000_000_000
      ? `$${(amount / 1_000_000_000).toFixed(1)}bn`
      : `$${(amount / 1_000_000).toFixed(0)}m`;

    return `${value} (${latestBudget.year}${latestBudget.is_estimate ? " est." : ""})`;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <Link
            href="/countries"
            className="text-[10px] font-bold uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors"
          >
            ← Country index
          </Link>

          <h1 className="text-4xl font-bold tracking-tight text-white">
            {country.name || "Unnamed country"}
          </h1>

          <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">
            {getCountryRegion(country)} · {country.iso_code || "ISO not recorded"}
          </p>
        </div>

        <div className="text-right bg-slate-900 border border-slate-800 p-3 rounded">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">
            Record status
          </p>
          <p className="text-2xl font-mono text-green-400 font-bold">
            {country.name ? "LIVE" : "MISS"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-3 rounded border border-slate-800 bg-slate-900/50">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">
            Latest budget
          </p>
          <p className="text-2xl font-mono font-bold text-white mt-1">
            {formatBudget()}
          </p>
        </div>

        <div className="p-3 rounded border border-slate-800 bg-slate-900/50">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">
            Inventory holdings
          </p>
          <p className="text-2xl font-mono font-bold text-white mt-1">
            {resolvedHoldings.length}
          </p>
        </div>

        <div className="p-3 rounded border border-slate-800 bg-slate-900/50">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">
            Contracts
          </p>
          <p className="text-2xl font-mono font-bold text-white mt-1">
            {contracts.length}
          </p>
        </div>

        <div className="p-3 rounded border border-slate-800 bg-slate-900/50">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">
            ISO code
          </p>
          <p className="text-2xl font-mono font-bold text-white mt-1">
            {country.iso_code || "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <JointProgrammesSection programmes={(programmesResult.data ?? []) as never[]} />
        <ProjectedSpendingSection
          history={(budgetsResult.data ?? []).filter((b) => !b.is_estimate)}
          projections={(budgetsResult.data ?? []).filter((b) => b.is_estimate)}
          countryId={countryId}
        />
        <CountryConflictsSection conflicts={(conflictsResult.data ?? []) as never[]} />
        <MarketsSection markets={(marketsResult.data ?? []) as never[]} />
      </div>

      <ArmySizeSection rows={(oobResult.data ?? []) as never[]} />

      {symbols.length > 0 && (
        <CountryMarketPanel symbols={symbols} selectedSymbol={mktSymbol ?? undefined} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DomesticContractorsSection contractors={(contractorsResult.data ?? []) as never[]} />
        <div className="space-y-6">
          {spaceRows.length > 0 && (
            <section className="rounded border border-slate-800 bg-slate-900/50 p-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
                Space capability
              </h2>
              <ul className="mt-2 divide-y divide-slate-800">
                {spaceRows.slice(0, 3).map((s) => (
                  <li key={s.id} className="py-2 text-xs text-slate-400">
                    <span className="font-mono text-[10px] uppercase text-slate-300">
                      {formatLabel(s.domain)}
                    </span>
                    {s.status ? ` · ${s.status}` : ""} — {s.summary}
                  </li>
                ))}
              </ul>
              <Link
                href={`/space?country=${countryId}`}
                className="mt-2 inline-block text-xs text-blue-500 hover:text-blue-400"
              >
                Space capability registry →
              </Link>
            </section>
          )}
          <section className="rounded border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
              Legislation
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Latest items from the legislative pipeline touching this country.
            </p>
            {(legislation ?? []).length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">No tracked legislation for this country yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-800">
                {(legislation ?? []).map((leg) => (
                  <li key={leg.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                    <Link
                      href={`/legislation?country=${countryId}`}
                      className="text-slate-200 hover:text-blue-400"
                    >
                      {leg.title}
                    </Link>
                    <span className="text-[10px] font-mono uppercase text-slate-500">
                      {leg.stage ?? "—"} · {leg.expected_date ?? "date n/a"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/legislation?country=${countryId}`}
              className="mt-2 inline-block text-xs text-blue-500 hover:text-blue-400"
            >
              Full pipeline →
            </Link>
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
            Linked contracts · {contracts.length}
          </h2>
          {contracts.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">No contracts are currently linked to this country.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-800">
              {contracts.slice(0, 8).map((contract) => (
                <li key={contract.id} className="py-2 text-sm">
                  <Link href={`/contracts/${contract.id}`} className="text-slate-200 hover:text-blue-400">
                    {contract.title || `Contract ${contract.id}`}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
            Capabilities
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {resolvedHoldings.length} holding{resolvedHoldings.length === 1 ? "" : "s"}
            feed the capability tracker — holdings, readiness and deployments
            per branch.
          </p>
          <Link
            href={`/equipment?country=${countryId}#inventory`}
            className="mt-2 inline-block text-xs text-blue-500 hover:text-blue-400"
          >
            Open capability tracker →
          </Link>
        </div>
      </div>

      <div id="inventory" className="space-y-6 border-t border-slate-800 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
              Equipment inventory
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Army · Navy · Air Force holdings with readiness and deployment.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wider">
            <a href="#inventory-overview" className="rounded border border-slate-700 px-2 py-1 text-slate-300">Overview</a>
            <a href="#inventory-army" className="rounded border border-slate-700 px-2 py-1 text-slate-300">Army</a>
            <a href="#inventory-navy" className="rounded border border-slate-700 px-2 py-1 text-slate-300">Navy</a>
            <a href="#inventory-air-force" className="rounded border border-slate-700 px-2 py-1 text-slate-300">Air Force</a>
            <a href="#ai-defence" className="rounded border border-slate-700 px-2 py-1 text-slate-300">AI in Defence</a>
          </div>
        </div>
        <div id="inventory-overview" className="scroll-mt-24">
          <ReadinessStrip holdings={resolvedHoldings} />
        </div>
        <BranchSection branch="army" holdings={armyHoldings} anchor="inventory-army" />
        <div className="space-y-4">
          <BranchSection branch="navy" holdings={navyHoldings} anchor="inventory-navy" />
          <CarrierAirWingCard wings={wingCards} />
        </div>
        <BranchSection branch="air_force" holdings={airForceHoldings} anchor="inventory-air-force" />
        <AIDefenceSection projects={aiCards} />
      </div>
      <section className="rounded border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
          Inventory methodology
        </h2>
        <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-400">
          Holdings represent records currently associated with this country.
          Operational vs maintenance splits, deployment areas and activity are
          shown exactly as reported — undisclosed locations are never inferred.
          AI entries cover government programmes with company, programme and
          contract links where recorded.
        </p>
      </section>
    </div>
  );
}
