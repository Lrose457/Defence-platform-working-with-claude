import Link from "next/link";
import { formatUsd, formatLabel, formatNumber } from "@/lib/format";
import { IntensityBadge } from "@/components/IntensityBadge";

/* ---------------------------------- Joint programmes ---------------------------------- */

type ProgrammeRow = {
  id: number;
  name: string;
  status: string | null;
  partner_countries: string[] | null;
  country_ids: number[] | null;
};

export function JointProgrammesSection({ programmes }: { programmes: ProgrammeRow[] }) {
  return (
    <section className="rounded border border-slate-800 bg-slate-900/50 p-4">
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
        Joint programmes
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Multi-country programmes this nation participates in (e.g. GCAP, AUKUS).
      </p>
      {programmes.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No joint programme records for this country yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-800">
          {programmes.map((p) => (
            <li key={p.id} className="flex flex-wrap items-baseline gap-2 py-2 text-sm">
              <Link href={`/programmes/${p.id}`} className="font-medium text-slate-200 hover:text-blue-400">
                {p.name}
              </Link>
              <span className="text-[10px] font-mono uppercase text-slate-500">
                {p.status ?? "status not recorded"}
              </span>
              <span className="ml-auto text-[11px] text-slate-500">
                {"Partners: "}
                {(p.partner_countries ?? []).length === 0
                  ? "not recorded"
                  : (p.partner_countries ?? []).map((name, i) => {
                      const pid = p.country_ids?.[i];
                      const label =
                        pid != null ? (
                          <Link
                            key={`${name}-${pid}`}
                            href={`/countries/${pid}`}
                            className="text-slate-400 hover:text-blue-400"
                          >
                            {name}
                          </Link>
                        ) : (
                          <span key={`${name}-${i}`}>{name}</span>
                        );
                      return i < (p.partner_countries ?? []).length - 1
                        ? [label, ", "]
                        : label;
                    })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------ Projected spending ------------------------------ */

type ProjectionRow = {
  year: number;
  amount_usd: number | null;
  is_estimate: boolean;
};

export function ProjectedSpendingSection({
  history,
  projections,
  countryId,
}: {
  history: ProjectionRow[];
  projections: ProjectionRow[];
  countryId: number;
}) {
  const all = [...history, ...projections].sort((a, b) => a.year - b.year);
  const max = Math.max(...all.map((r) => r.amount_usd ?? 0), 1);

  return (
    <section className="rounded border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
          Spending history &amp; projections
        </h2>
        <Link
          href={`/contracts?country=${countryId}`}
          className="text-[10px] font-mono text-blue-500 hover:underline"
        >
          PIPELINE →
        </Link>
      </div>
      {all.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No budget records for this country yet.</p>
      ) : (
        <>
          <div className="mt-4 flex h-32 items-end gap-1.5">
            {all.map((r) => (
              <div key={`${r.year}-${r.is_estimate}`} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t ${r.is_estimate ? "bg-sky-800/60 border border-dashed border-sky-500" : "bg-sky-600"}`}
                  style={{ height: `${Math.max(3, ((r.amount_usd ?? 0) / max) * 100)}%` }}
                  title={`${r.year}: ${formatUsd(r.amount_usd)}${r.is_estimate ? " (projection)" : ""}`}
                />
                <span className="text-[9px] font-mono text-slate-500">{String(r.year).slice(2)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-600">
            Solid bars: recorded budgets. Dashed bars: projections derived from
            published government plans — never interpolated. Source: SIPRI /
            national budget documents via the spending pipeline.
          </p>
        </>
      )}
    </section>
  );
}

/* ---------------------------------- Conflicts ---------------------------------- */

type ConflictRow = {
  conflict_id: number | string;
  name: string;
  status: string | null;
  intensity_level: number | null;
  region: string | null;
};

export function CountryConflictsSection({ conflicts }: { conflicts: ConflictRow[] }) {
  return (
    <section className="rounded border border-slate-800 bg-slate-900/50 p-4">
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
        Conflicts
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Conflicts this country is directly involved in, with intensity.
      </p>
      {conflicts.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          No direct involvement in tracked conflicts is recorded.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-800">
          {conflicts.map((c) => (
            <li key={c.conflict_id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <Link href={`/conflicts/${c.conflict_id}`} className="text-slate-200 hover:text-blue-400">
                {c.name}
              </Link>
              <IntensityBadge level={c.intensity_level} />
              <span className="ml-auto text-[11px] text-slate-500">{c.region ?? ""}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------------------------- Markets ---------------------------------- */

type MarketRow = {
  bloc: string;
  relationship: string | null;
  share_percent: number | null;
};

export function MarketsSection({ markets }: { markets: MarketRow[] }) {
  return (
    <section className="rounded border border-slate-800 bg-slate-900/50 p-4">
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
        Market alignment
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Which defence market this country primarily buys from and partners with.
      </p>
      {markets.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">Market alignment not yet recorded for this country.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {markets.map((m) => (
            <li key={m.bloc} className="flex items-center gap-3 text-xs">
              <span className="w-28 shrink-0 font-medium text-slate-300">{m.bloc}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded bg-slate-900">
                <div
                  className="h-full rounded bg-blue-600"
                  style={{ width: `${Math.min(100, m.share_percent ?? 0)}%` }}
                />
              </div>
              <span className="w-24 text-right font-mono text-slate-500">
                {m.share_percent != null ? `${m.share_percent}%` : formatLabel(m.relationship)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------------------------- Army sizes ---------------------------------- */

type OrderOfBattleRow = {
  branch: string | null;
  unit_type: string | null;
  units: number | null;
  personnel: number | null;
  equipment_id: number | null;
  equipment_name: string | null;
  held_qty: number | null;
  required_qty: number | null;
};

export function ArmySizeSection({ rows }: { rows: OrderOfBattleRow[] }) {
  return (
    <section className="rounded border border-slate-800 bg-slate-900/50 p-4">
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
        Force structure
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Fielded formations, cross-referenced against the equipment holdings
        needed to support them.
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">Force structure not yet recorded for this country.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Force structure</caption>
            <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2 pr-3" scope="col">Branch</th>
                <th className="py-2 pr-3" scope="col">Formation</th>
                <th className="py-2 pr-3 text-right" scope="col">Units</th>
                <th className="py-2 pr-3 text-right" scope="col">Personnel</th>
                <th className="py-2 pr-3" scope="col">Key equipment check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((r, i) => {
                const shortfall =
                  r.held_qty != null && r.required_qty != null && r.held_qty < r.required_qty;
                return (
                  <tr key={`${r.branch}-${r.unit_type}-${i}`}>
                    <td className="py-2 pr-3 text-slate-400">{formatLabel(r.branch)}</td>
                    <td className="py-2 pr-3 text-slate-300">{formatLabel(r.unit_type)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-300">{formatNumber(r.units)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-300">{formatNumber(r.personnel)}</td>
                    <td className="py-2 pr-3 text-slate-400">
                      {r.equipment_name ? (
                        <>
                          <Link href={`/equipment/${r.equipment_id}`} className="hover:text-blue-400">
                            {r.equipment_name}
                          </Link>
                          <span className={shortfall ? "text-amber-400" : "text-green-400"}>
                            {" "}
                            {formatNumber(r.held_qty)}/{formatNumber(r.required_qty)}
                            {shortfall ? " ⚠ below establishment" : ""}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------------------------------- Domestic contractors ---------------------------------- */

type ContractorRow = {
  id: number;
  name: string;
  sector: string | null;
  company_type: string | null;
  contract_count: number;
};

export function DomesticContractorsSection({
  contractors,
}: {
  contractors: ContractorRow[];
}) {
  return (
    <section className="rounded border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
          Domestic contractors · {contractors.length}
        </h2>
        <span className="text-[10px] text-slate-600">Industrial base headquartered here</span>
      </div>
      {contractors.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          No domestic contractors recorded for this country yet.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {contractors.map((c) => (
            <li key={c.id}>
              <Link
                href={`/companies/${c.id}`}
                className="flex items-baseline justify-between gap-2 rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm hover:border-blue-800"
              >
                <span className="text-slate-200">{c.name}</span>
                <span className="font-mono text-[10px] text-slate-500">
                  {c.contract_count} contract{c.contract_count === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
