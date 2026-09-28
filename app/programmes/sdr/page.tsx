import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatLabel, formatDateHuman } from "@/lib/format";

export const metadata = {
  title: "Future Projects — Defence Intelligence Platform",
  description:
    "Forward-looking tracker for defence reviews and future projects, with programme implications per country.",
};

type ReviewRow = {
  id: number;
  title: string;
  country_id: number | null;
  country_name: string | null;
  body: string | null;
  stage: string | null;
  expected_date: string | null;
  description: string | null;
  source_name: string | null;
  source_url: string | null;
};

export default async function SDRPage() {
  const supabase = await createClient();

  /*
   * Reviews are tracked in the legislation pipeline with kind='defence_review'
   * so they ride the same reviewed-ingestion and sourcing rails as bills.
   */
  const { data, error } = await supabase
    .from("legislation_pipeline")
    .select(
      "id, title, body, stage, description, expected_date, source_name, source_url, country_id, country_name",
    )
    .eq("kind", "defence_review")
    .order("expected_date", { ascending: true, nullsFirst: false })
    .limit(50);

  const rows = (data ?? []) as unknown as ReviewRow[];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Future Projects
          </h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Future-oriented · reviews, timings and programme implications
          </p>
        </div>
      </div>

      <section className="rounded border border-slate-800 bg-slate-900/50 p-4 text-xs leading-5 text-slate-400">
        <p>
          Strategic defence reviews signal where money and capability are
          heading. Each tracked review links to its country, publishing status,
          and expected milestone. Programme-level implications are attached to
          the underlying programme records as they are confirmed — not
          speculated in advance.
        </p>
      </section>

      {error ? (
        <div className="rounded border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-200">
          Review tracking is being provisioned alongside the legislative
          pipeline. Entries appear once ingested and reviewed.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
          No defence reviews are tracked yet. Add them through the ingestion
          pipeline with kind <span className="font-mono">defence_review</span>.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <article key={r.id} className="rounded border border-slate-800 bg-slate-900/50 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-100">{r.title}</h2>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  {formatLabel(r.stage)} · {formatDateHuman(r.expected_date)}
                </span>
              </div>
              <p className="mt-1 text-[11px] font-mono uppercase text-slate-500">
                {r.country_name ? (
                  <Link href={`/countries/${r.country_id}`} className="hover:text-blue-400">
                    {r.country_name}
                  </Link>
                ) : (
                  r.body ?? "—"
                )}
              </p>
              {r.description && (
                <p className="mt-2 text-xs leading-5 text-slate-400">{r.description}</p>
              )}
              {r.source_url && (
                <a
                  href={r.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-[11px] text-blue-500 hover:text-blue-400"
                >
                  Source: {r.source_name ?? r.source_url} ↗
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
