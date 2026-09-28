import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatLabel } from "@/lib/format";

export const metadata = {
  title: "Space Capability — Defence Intelligence Platform",
  description:
    "Space power across tracked countries: orbital launch, satcom, Earth observation, PNT, missile warning, space domain awareness and space forces.",
};

type SpaceRow = {
  id: number;
  country_id: number;
  country_name: string | null;
  domain: string | null;
  status: string | null;
  summary: string | null;
  source_name: string | null;
  source_url: string | null;
  evidence_level: string | null;
};

export default async function SpacePage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("country_space_overview")
    .select(
      "id, country_id, country_name, domain, status, summary, source_name, source_url, evidence_level",
    )
    .limit(300);

  const rows = (data ?? []) as SpaceRow[];

  const byCountry = new Map<number, { name: string; entries: SpaceRow[] }>();
  for (const row of rows) {
    const entry = byCountry.get(row.country_id) ?? {
      name: row.country_name ?? `Country ${row.country_id}`,
      entries: [],
    };
    entry.entries.push(row);
    byCountry.set(row.country_id, entry);
  }

  const domains = [...new Set(rows.map((r) => r.domain).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Space Capability</h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Space forces &amp; space systems · {rows.length} entries across {byCountry.size} countries
          </p>
        </div>
      </div>

      <section className="rounded border border-slate-800 bg-slate-900/50 p-4 text-xs leading-5 text-slate-400">
        <p>
          Scope: military and national space capability — space forces, orbital
          launch, satellite communications, Earth observation, positioning,
          navigation and timing (PNT), missile warning and space domain
          awareness. Entries are descriptive with evidence levels; summaries
          paraphrase public government sources.
        </p>
        {domains.length > 0 && (
          <p className="mt-2">
            Domains tracked: {domains.map((d) => formatLabel(d)).join(" · ")}
          </p>
        )}
      </section>

      {error ? (
        <div className="rounded border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-200">
          Space capability records are being provisioned. They will appear here
          once ingested and reviewed.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
          No space capability records yet.
        </div>
      ) : (
        [...byCountry.entries()]
          .sort(([, a], [, b]) => b.entries.length - a.entries.length)
          .map(([countryId, { name, entries }]) => (
            <section key={countryId} className="space-y-2">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 border-l-2 border-blue-600 pl-2">
                <Link href={`/countries/${countryId}`} className="hover:text-slate-300">
                  {name}
                </Link>{" "}
                · {entries.length}
              </h2>
              <div className="grid gap-2">
                {entries.map((s) => (
                  <article
                    key={s.id}
                    className="rounded border border-slate-800 bg-slate-900/50 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h3 className="text-sm font-medium text-slate-200">
                        {formatLabel(s.domain)}
                      </h3>
                      {s.status && (
                        <span className="text-[10px] font-mono uppercase text-slate-500">
                          {s.status}
                        </span>
                      )}
                      {s.evidence_level && (
                        <span className="text-[10px] font-mono uppercase text-slate-600">
                          {formatLabel(s.evidence_level)}
                        </span>
                      )}
                    </div>
                    {s.summary && <p className="mt-1 text-xs text-slate-400">{s.summary}</p>}
                    {s.source_url && (
                      <div className="mt-1 text-[11px]">
                        <a
                          href={s.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-500 hover:text-blue-400"
                        >
                          Source{sourceLabel(s)} →
                        </a>
                      </div>
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

function sourceLabel(s: SpaceRow): string {
  return s.source_name ? `: ${s.source_name}` : "";
}
