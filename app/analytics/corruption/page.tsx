import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatUsd } from "@/lib/format";

type Flag = {
  severity: "high" | "medium";
  rule: string;
  title: string;
  detail: string;
  href: string;
};

export const revalidate = 300;

export const metadata = {
  title: "Corruption Risk Signals — Defence Intelligence Platform",
  description:
    "Transparent, rule-based corruption risk flags derived from contract metadata.",
};

/*
 * Transparent rule set (patch 0.2 doc: "Corruption index — needs
 * improvement"). Every rule is mechanical and auditable — no composite
 * secret sauce, no country scores invented from opinion. A flag is a
 * prompt to investigate, never an allegation.
 */
export default async function CorruptionIndexPage() {
  const supabase = await createClient();

  const { data: contracts, error } = await supabase
    .from("contracts")
    .select(
      "id, title, value, value_usd, status, data_confidence, company_id, company_name, country_id, source_id, source_name, source_reliability",
    )
    .order("value_usd", { ascending: false, nullsFirst: false })
    .limit(500);

  const rows = contracts ?? [];
  const flags: Flag[] = [];

  for (const c of rows) {
    const value = c.value_usd ?? (c.value != null ? Number(c.value) : null);
    if (value == null || Number.isNaN(value)) continue;

    // Rule 1: high-value contract with low-reliability sourcing.
    if (
      value >= 100_000_000 &&
      (c.source_reliability ?? "").toLowerCase() === "low"
    ) {
      flags.push({
        severity: "high",
        rule: "High value · low-reliability source",
        title: c.title ?? `Contract ${c.id}`,
        detail: `Valued at ${formatUsd(value)} but sourced only from a source graded low-reliability${
          c.source_name ? ` (${c.source_name})` : ""
        }.`,
        href: `/contracts/${c.id}`,
      });
    }

    // Rule 2: high-value contract with low recorded confidence.
    if (
      value >= 250_000_000 &&
      (c.data_confidence ?? "").toLowerCase() === "low"
    ) {
      flags.push({
        severity: "medium",
        rule: "High value · low confidence",
        title: c.title ?? `Contract ${c.id}`,
        detail: `Valued at ${formatUsd(value)} with low data confidence — figures are not corroborated.`,
        href: `/contracts/${c.id}`,
      });
    }

    // Rule 3: high-value contract with no source at all.
    if (value >= 100_000_000 && !c.source_id && !c.source_name) {
      flags.push({
        severity: "high",
        rule: "High value · unsourced",
        title: c.title ?? `Contract ${c.id}`,
        detail: `Valued at ${formatUsd(value)} with no source record attached. Treated as unverified.`,
        href: `/contracts/${c.id}`,
      });
    }
  }

  const high = flags.filter((f) => f.severity === "high").length;
  const medium = flags.length - high;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Corruption Risk Signals
          </h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Rule-based red flags · not a corruption score
          </p>
        </div>
      </div>

      <section className="rounded border border-slate-800 bg-slate-900/50 p-4 text-xs leading-5 text-slate-400">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-300">
          Methodology
        </h2>
        <p className="mt-2">
          This page deliberately does <strong>not</strong> publish a single
          &quot;corruption score&quot; per company or country: composite indices
          hide their assumptions and invite misreading. Instead, mechanical,
          published rules flag contract records whose metadata warrants
          investigation (high value with weak sourcing, low confidence, or no
          source). Every flag links to the underlying record with its evidence.
        </p>
        <p className="mt-2">
          Scandal coverage and investigative records live in{" "}
          <Link href="/investigations" className="intel-link">Investigations</Link>{" "}
          and company <em>revolving-door</em> panels. Corrections: contact us via
          the <Link href="/data-licences" className="intel-link">data licences page</Link>.
        </p>
      </section>

      {error ? (
        <div className="rounded border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-200">
          Risk signals are being provisioned. They will appear once contract
          records with source metadata are ingested.
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-600">Contracts reviewed</p>
              <p className="mt-2 text-2xl font-semibold">{rows.length.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-600">High-severity flags</p>
              <p className="mt-2 text-2xl font-semibold text-red-400">{high}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-600">Medium-severity flags</p>
              <p className="mt-2 text-2xl font-semibold text-amber-400">{medium}</p>
            </div>
          </section>

          <section className="space-y-3">
            {flags.length === 0 ? (
              <div className="rounded border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
                No records currently trip the published rules. This reflects the
                metadata captured so far, not an absence of risk.
              </div>
            ) : (
              flags.slice(0, 100).map((f, i) => (
                <Link
                  key={`${f.href}-${i}`}
                  href={f.href}
                  className="block rounded border border-slate-800 bg-slate-900/50 p-4 hover:border-slate-600"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${
                        f.severity === "high"
                          ? "bg-red-900/40 text-red-300 border border-red-800"
                          : "bg-amber-900/40 text-amber-300 border border-amber-800"
                      }`}
                    >
                      {f.severity}
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                      {f.rule}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-slate-200">{f.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{f.detail}</p>
                </Link>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
