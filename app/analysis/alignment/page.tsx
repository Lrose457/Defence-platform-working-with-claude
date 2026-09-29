import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AlignmentPendulum from "@/components/AlignmentPendulum";

export const metadata = {
  title: "Alignment & Symbolic Defence — Defence Intelligence Platform",
  description:
    "The pendulum alignment model, IR-theory framing and the symbolic defence ledger.",
};

export default async function AlignmentPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("countries")
    .select("id, name, region")
    .order("name")
    .limit(120);

  const { data: markets } = await supabase
    .from("country_market_overview")
    .select("country_id, country_name, bloc, share_percent")
    .limit(300);

  /*
   * Pendulum positions are computed from recorded market alignment: the
   * share a country buys from Western vs non-Western supplier blocs.
   * Countries without records are listed but not positioned.
   */
  const western = new Set(["NATO", "EU", "United States", "Europe", "QUAD"]);
  const eastern = new Set(["China", "Russia", "CSTO", "BRICS"]);

  const positions: { id: number; name: string; position: number | null; basis: string | null }[] = [];
  for (const c of data ?? []) {
    const rows = (markets ?? []).filter((m) => m.country_id === c.id);
    if (rows.length === 0) {
      positions.push({ id: c.id, name: c.name, position: null, basis: null });
      continue;
    }
    let west = 0;
    let east = 0;
    let basis: string | null = null;
    for (const r of rows) {
      const share = r.share_percent ?? 0;
      if (western.has(r.bloc)) west += share;
      else if (eastern.has(r.bloc)) east += share;
      if (!basis && r.bloc) basis = r.bloc;
    }
    const total = west + east;
    positions.push({
      id: c.id,
      name: c.name,
      position: total > 0 ? Math.round(((east - west) / total + 1) * 50) : null,
      basis,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Alignment &amp; Symbolic Defence
          </h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            IR theory applied to tracked data · hedging visualised
          </p>
        </div>
      </div>

      {/* Pendulum alignment model */}
      <section className="rounded border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
          Pendulum alignment model
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Each country&apos;s position is computed from its recorded supplier-bloc
          mix: 0 = fully Western-aligned, 100 = fully non-Western-aligned,
          50 = hedging. Positions move as procurement data changes — a
          &quot;pendulum&quot; you can read over time. Countries without recorded
          procurement alignment are not positioned.
        </p>
        <AlignmentPendulum positions={positions.filter((p) => p.position !== null) as { id: number; name: string; position: number }[]} />
        {positions.some((p) => p.position === null) && (
          <p className="mt-2 text-[10px] text-slate-600">
            Not positioned (no supplier-bloc records):{" "}
            {positions
              .filter((p) => p.position === null)
              .map((p) => p.name)
              .slice(0, 12)
              .join(", ")}
            {positions.filter((p) => p.position === null).length > 12 && "…"}
          </p>
        )}
      </section>

      {/* IR theory framing */}
      <section className="rounded border border-slate-800 bg-slate-900/50 p-4 text-sm leading-6 text-slate-300">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
          Reading the data through IR theory
        </h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-3 text-xs">
          <div>
            <h3 className="font-semibold text-slate-100">Structural realism</h3>
            <p className="mt-1 text-slate-400">
              Spending patterns on the{" "}
              <Link href="/analytics" className="intel-link">financial analytics</Link>{" "}
              page reflect capability competition, not just threat rhetoric:
              watch whether budgets track rivals&apos; budgets or internal
              politics.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">Liberal institutionalism</h3>
            <p className="mt-1 text-slate-400">
              Joint programmes (GCAP, AUKUS) on country pages show how
              institutions pool sovereignty and cost. Their health is a proxy
              for alliance durability beyond any single government.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">Constructivism</h3>
            <p className="mt-1 text-slate-400">
              The symbolic defence ledger below captures spending whose primary
              function is identity and signalling — data that realist models
              systematically underweight.
            </p>
          </div>
        </div>
      </section>

      {/* Symbolic defence ledger */}
      <section className="rounded border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
          Symbolic defence ledger
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Programmes and pledges whose primary value is political signalling —
          and what equivalent capability the same money could buy. Entries are
          recorded by analysts with sources; this is explicitly an editorial
          layer, separated from factual records.
        </p>
        <div className="mt-3 rounded border border-dashed border-slate-700 p-4 text-xs text-slate-500">
          No symbolic-defence entries recorded yet. Analysts add them via the
          ingestion pipeline with entity type{" "}
          <span className="font-mono">symbolic_defence</span>; each entry must
          state the signalling claim, the counterfactual capability, and its
          source.
        </div>
      </section>
    </div>
  );
}
