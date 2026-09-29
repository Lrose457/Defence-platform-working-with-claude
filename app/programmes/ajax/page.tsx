import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatUsd, formatDateHuman } from "@/lib/format";

export const metadata = {
  title: "Case Study: Ajax — Defence Intelligence Platform",
  description:
    "The Ajax programme as a lens on the state of the British armed forces: timeline, cost, and delivery record.",
};

type ContractRow = {
  id: number;
  title: string | null;
  planned_value_usd: number | null;
  actual_value_usd: number | null;
  planned_end_date: string | null;
  actual_end_date: string | null;
  data_confidence: string | null;
};

type ChangeRow = {
  id: number;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  change_date: string | null;
  reason: string | null;
  source_name: string | null;
  data_confidence: string | null;
};

export default async function AjaxCaseStudyPage() {
  const supabase = await createClient();

  /*
   * All content is driven by reviewed records: the programme row, its
   * contracts and its recorded data changes. Nothing on this page is
   * hardcoded narrative — if the DB has no Ajax records yet, the page says
   * so rather than inventing a story.
   */
  const { data: programme } = await supabase
    .from("programmes")
    .select("id, name, status, description")
    .ilike("name", "%ajax%")
    .maybeSingle();

  if (!programme) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">Case Study: Ajax</h1>
        <div className="rounded border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
          The Ajax programme has not been ingested into the database yet. This
          case study will render from reviewed records (programme, contracts,
          recorded changes with sources) once ingestion is complete — this page
          deliberately contains no hardcoded narrative.
        </div>
        <Link href="/programmes" className="intel-link text-sm">← All programmes</Link>
      </div>
    );
  }

  const [{ data: contracts }, { data: changes }] = await Promise.all([
    supabase
      .from("contracts")
      .select(
        "id, title, planned_value_usd, actual_value_usd, planned_end_date, actual_end_date, data_confidence",
      )
      .eq("programme_id", programme.id)
      .order("contract_date", { ascending: false }),
    supabase
      .from("data_changes")
      .select("id, field_name, old_value, new_value, change_date, reason, source_name, data_confidence")
      .eq("entity_type", "programme")
      .eq("entity_id", programme.id)
      .order("change_date", { ascending: false })
      .limit(30),
  ]);

  const costRows = (contracts ?? []) as ContractRow[];
  const plannedTotal = costRows.reduce((sum, c) => sum + (c.planned_value_usd ?? 0), 0);
  const actualTotal = costRows.reduce((sum, c) => sum + (c.actual_value_usd ?? 0), 0);
  const overrunPercent =
    plannedTotal > 0 && actualTotal > 0
      ? Math.round(((actualTotal - plannedTotal) / plannedTotal) * 100)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500">
            Case study · what Ajax says about the British armed forces
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white">{programme.name}</h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            {programme.status ?? "Status not recorded"}
          </p>
        </div>
        <Link href={`/programmes/${programme.id}`} className="text-xs text-blue-500 hover:underline">
          Programme record →
        </Link>
      </div>

      {programme.description && (
        <p className="max-w-4xl text-sm leading-6 text-slate-300">{programme.description}</p>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Planned value (recorded)</p>
          <p className="mt-1 text-2xl font-mono font-bold text-white">{formatUsd(plannedTotal)}</p>
        </div>
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Actual value (recorded)</p>
          <p className="mt-1 text-2xl font-mono font-bold text-white">{formatUsd(actualTotal)}</p>
        </div>
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Recorded overrun</p>
          <p className={`mt-1 text-2xl font-mono font-bold ${overrunPercent && overrunPercent > 0 ? "text-red-400" : "text-green-400"}`}>
            {overrunPercent === null ? "n/a" : `+${overrunPercent}%`}
          </p>
        </div>
      </section>

      <section className="rounded border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
          Contract delivery record
        </h2>
        {costRows.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No contracts linked to this programme yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="intel-table">
              <caption className="sr-only">Ajax contracts</caption>
              <thead>
                <tr>
                  <th scope="col">Contract</th>
                  <th scope="col" className="text-right">Planned</th>
                  <th scope="col" className="text-right">Actual</th>
                  <th scope="col">Planned end</th>
                  <th scope="col">Actual end</th>
                  <th scope="col">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {costRows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/contracts/${c.id}`} className="text-slate-200 hover:text-blue-400">
                        {c.title ?? `Contract ${c.id}`}
                      </Link>
                    </td>
                    <td className="text-right font-mono text-slate-400">{formatUsd(c.planned_value_usd)}</td>
                    <td className="text-right font-mono text-slate-400">{formatUsd(c.actual_value_usd)}</td>
                    <td className="font-mono text-slate-500">{formatDateHuman(c.planned_end_date)}</td>
                    <td className="font-mono text-slate-500">{formatDateHuman(c.actual_end_date)}</td>
                    <td className="text-[10px] font-mono uppercase text-slate-500">{c.data_confidence ?? "n/a"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="intel-methodology">
          Figures are exactly as recorded in the platform&apos;s sources — the
          case study draws conclusions only from what the database can support.
          See the{" "}
          <Link href="/companies/effectiveness" className="intel-link">
            effectiveness methodology
          </Link>{" "}
          for how delivery performance is assessed.
        </p>
      </section>

      <section className="rounded border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
          Recorded changes timeline
        </h2>
        {(changes ?? []).length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No recorded changes for this programme yet.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {(changes as ChangeRow[]).map((ch) => (
              <li key={ch.id} className="border-l-2 border-slate-700 pl-3 text-xs">
                <p className="font-mono text-slate-500">
                  {formatDateHuman(ch.change_date)} · {ch.field_name ?? "field n/a"}
                </p>
                <p className="mt-0.5 text-slate-300">
                  {ch.old_value ?? "—"} → {ch.new_value ?? "—"}
                </p>
                {ch.reason && <p className="mt-0.5 text-slate-500">{ch.reason}</p>}
                {ch.source_name && (
                  <p className="mt-0.5 text-[10px] uppercase text-slate-600">
                    Source: {ch.source_name} · {ch.data_confidence ?? "n/a"}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
