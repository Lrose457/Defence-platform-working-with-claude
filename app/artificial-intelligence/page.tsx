import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatLabel } from "@/lib/format";

export const metadata = {
  title: "AI in Defence — Registry — Defence Intelligence Platform",
  description:
    "Government AI defence projects across tracked countries: programmes, agencies and industry links.",
};

type ProjectRow = {
  id: number;
  programme_name: string | null;
  domain: string | null;
  status: string | null;
  lead_agency: string | null;
  company_name: string | null;
  company_id: number | null;
  country_id: number;
  country_name: string | null;
  description: string | null;
  evidence_level: string | null;
};

export default async function AIRegistryPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ai_defence_project_overview")
    .select(
      "id, programme_name, domain, status, lead_agency, company_name, company_id, country_id, country_name, description, evidence_level",
    )
    .limit(300);

  const rows = (data ?? []) as ProjectRow[];

  const byCountry = new Map<number, { name: string; projects: ProjectRow[] }>();
  for (const row of rows) {
    const entry = byCountry.get(row.country_id) ?? {
      name: row.country_name ?? `Country ${row.country_id}`,
      projects: [],
    };
    entry.projects.push(row);
    byCountry.set(row.country_id, entry);
  }

  const domains = [...new Set(rows.map((r) => r.domain).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">AI in Defence</h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Government AI projects · {rows.length} entries across {byCountry.size} countries
          </p>
        </div>
      </div>

      <section className="rounded border border-slate-800 bg-slate-900/50 p-4 text-xs leading-5 text-slate-400">
        <p>
          Scope: projects where a government is applying AI to defence functions
          — targeting support, logistics, autonomy, intelligence processing,
          training and simulation. Each entry links the lead agency and, where
          recorded, the industry partner and contract. Inclusion is descriptive;
          entries carry evidence levels.
        </p>
        {domains.length > 0 && (
          <p className="mt-2">
            Domains tracked: {domains.map((d) => formatLabel(d)).join(" · ")}
          </p>
        )}
      </section>

      {error ? (
        <div className="rounded border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-200">
          AI project records are being provisioned. They will appear here once
          ingested and reviewed.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
          No AI defence projects recorded yet. Country pages also show their
          domestic AI entries under “AI in defence”.
        </div>
      ) : (
        [...byCountry.entries()]
          .sort(([, a], [, b]) => b.projects.length - a.projects.length)
          .map(([countryId, { name, projects }]) => (
            <section key={countryId} className="space-y-2">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 border-l-2 border-blue-600 pl-2">
                <Link href={`/countries/${countryId}`} className="hover:text-slate-300">
                  {name}
                </Link>{" "}
                · {projects.length}
              </h2>
              <div className="grid gap-2">
                {projects.map((p) => (
                  <article
                    key={p.id}
                    className="rounded border border-slate-800 bg-slate-900/50 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h3 className="text-sm font-medium text-slate-200">
                        {p.programme_name ?? "Unnamed programme"}
                      </h3>
                      <span className="text-[10px] font-mono uppercase text-slate-500">
                        {formatLabel(p.domain)}
                      </span>
                      <span className="text-[10px] font-mono uppercase text-slate-600">
                        {p.status ?? formatLabel(null)}
                      </span>
                    </div>
                    {p.description && (
                      <p className="mt-1 text-xs text-slate-400">{p.description}</p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
                      {p.lead_agency && <span>Lead: {p.lead_agency}</span>}
                      {p.company_id && (
                        <Link href={`/companies/${p.company_id}`} className="text-blue-500 hover:text-blue-400">
                          Industry: {p.company_name}
                        </Link>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
      )}
    </div>
  );
}
