import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatLabel } from "@/lib/format";

export const metadata = {
  title: "Non-State Actors — Defence Intelligence Platform",
  description:
    "Private military companies, paramilitaries, terrorist organisations and their funding networks.",
};

type ActorRow = {
  id: number | string;
  name: string;
  actor_type: string | null;
  region: string | null;
  status: string | null;
  summary: string | null;
  funder_names: string[] | null;
  source_name: string | null;
  source_url: string | null;
  evidence_level: string | null;
};

const TYPE_ORDER = ["pmc", "paramilitary", "terrorist", "insurgent", "other"];

export default async function ActorsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("nonstate_actor_overview")
    .select(
      "id, name, actor_type, region, status, summary, funder_names, source_name, source_url, evidence_level",
    )
    .limit(200);

  const rows = (data ?? []) as ActorRow[];

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    rows: rows.filter((r) => (r.actor_type ?? "other").toLowerCase() === type),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Non-State Actors</h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            PMCs · paramilitaries · terrorist organisations · funding networks
          </p>
        </div>
      </div>

      <section className="rounded border border-slate-800 bg-slate-900/50 p-4 text-xs leading-5 text-slate-400">
        <p>
          Records are intentionally <strong>descriptive, not operational</strong>:
          the platform documents structure, activities as publicly reported, and
          funding links with sources. It does not publish locations of active
          personnel, tactical detail, or anything that could enable violence.
          Terrorist listings follow UK proscription where applicable and are
          labelled as such. See the{" "}
          <Link href="/acceptable-use" className="intel-link">acceptable use policy</Link>.
        </p>
      </section>

      {error ? (
        <div className="rounded border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-200">
          Non-state actor records are being provisioned. They will appear here
          once ingested and reviewed.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
          No non-state actor records yet. Entries appear only after reviewed
          ingestion with a public source.
        </div>
      ) : (
        grouped.map(({ type, rows: groupRows }) => (
          <section key={type} className="space-y-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 border-l-2 border-blue-600 pl-2">
              {formatLabel(type)} · {groupRows.length}
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {groupRows.map((actor) => (
                <article
                  key={actor.id}
                  className="rounded border border-slate-800 bg-slate-900/50 p-4"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="text-sm font-semibold text-slate-100">{actor.name}</h3>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${
                        actor.status === "Active"
                          ? "bg-red-900/40 text-red-300 border border-red-800"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {actor.status ?? "status n/a"}
                    </span>
                    <span className="text-[10px] font-mono uppercase text-slate-600">
                      {actor.evidence_level ?? "unverified"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-mono uppercase text-slate-500">
                    {actor.region ?? "Region not recorded"}
                  </p>
                  {actor.summary && (
                    <p className="mt-2 text-xs leading-5 text-slate-400">{actor.summary}</p>
                  )}
                  <div className="mt-2 text-[11px] text-slate-500">
                    <span className="font-semibold uppercase tracking-wider text-slate-600">
                      Funding:
                    </span>{" "}
                    {(actor.funder_names ?? []).length > 0
                      ? actor.funder_names!.join(" · ")
                      : "no funding links recorded"}
                  </div>
                  {actor.source_url && (
                    <a
                      href={actor.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-[11px] text-blue-500 hover:text-blue-400"
                    >
                      Source: {actor.source_name ?? actor.source_url} ↗
                    </a>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
