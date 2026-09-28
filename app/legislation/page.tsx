import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatLabel, formatDateHuman } from "@/lib/format";

type LegislationRow = {
  id: number;
  title: string;
  country_id: number | null;
  country_name: string | null;
  body: string | null;
  stage: string | null;
  description: string | null;
  source_id: number | null;
  source_name: string | null;
  source_reliability: string | null;
  source_url: string | null;
  expected_date: string | null;
};

const STAGE_STYLES: Record<string, string> = {
  proposed: "bg-slate-800 text-slate-300 border border-slate-700",
  introduced: "bg-blue-900/40 text-blue-300 border border-blue-800",
  "under review": "bg-amber-900/40 text-amber-300 border border-amber-800",
  passed: "bg-blue-900/40 text-blue-300 border border-blue-800",
  funded: "bg-green-900/40 text-green-400 border border-green-800",
  enacted: "bg-green-900/40 text-green-400 border border-green-800",
  withdrawn: "bg-slate-800 text-slate-500 border border-slate-700",
};

export const revalidate = 300;

export default async function LegislationPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const params = await searchParams;
  const countryId =
    params.country && params.country !== "" && Number.isFinite(Number(params.country))
      ? Number(params.country)
      : null;

  const supabase = await createClient();

  let query = supabase
    .from("legislation_pipeline_overview")
    .select(
      "id, title, country_id, country_name, body, stage, description, source_id, source_name, source_reliability, source_url, expected_date",
    )
    .order("expected_date", { ascending: true, nullsFirst: false })
    .limit(100);

  if (countryId != null) {
    query = query.eq("country_id", countryId);
  }

  const [{ data, error }, { data: country }] = await Promise.all([
    query,
    countryId != null
      ? supabase.from("countries").select("id, name, iso_code").eq("id", countryId).maybeSingle()
      : Promise.resolve({ data: null as { id: number; name: string; iso_code: string | null } | null }),
  ]);

  const rows = (data ?? []) as LegislationRow[];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Legislative Pipeline</h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Tracking defence bills, budget authorizations &amp; policy shifts
          </p>
        </div>
      </div>

      {country && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-blue-900/60 bg-blue-950/30 px-4 py-3 text-sm text-blue-200">
          <span>
            Pipeline for{" "}
            <Link href={`/countries/${country.id}`} className="underline hover:text-blue-300">
              {country.name}
            </Link>
            {country.iso_code ? ` (${country.iso_code})` : ""} — {rows.length} item
            {rows.length === 1 ? "" : "s"}
          </span>
          <Link href="/legislation" className="text-xs text-blue-400 underline hover:text-blue-300">
            Show all countries
          </Link>
        </div>
      )}

      {error ? (
        <div className="rounded border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-200">
          The legislative pipeline is being provisioned. Records will appear
          here once ingested and reviewed.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
          {countryId != null
            ? `No tracked legislation for ${country?.name ?? "this country"} yet. Bills appear here after source review in the ingestion pipeline.`
            : "No legislation is currently tracked. Bills appear here after source review in the ingestion pipeline."}
        </div>
      ) : (
        <div className="rounded border border-slate-800 bg-slate-900/50 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <caption className="sr-only">Legislative pipeline</caption>
            <thead className="bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
              <tr className="border-b border-slate-800">
                <th className="px-3 py-2 font-semibold" scope="col">Legislation / Bill</th>
                <th className="px-3 py-2 font-semibold" scope="col">Governing body</th>
                <th className="px-3 py-2 font-semibold" scope="col">Country</th>
                <th className="px-3 py-2 font-semibold" scope="col">Stage</th>
                <th className="px-3 py-2 font-semibold" scope="col">Expected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs">
              {rows.map((leg) => {
                const stageKey = (leg.stage ?? "").toLowerCase();
                const stageClass = STAGE_STYLES[stageKey] ?? STAGE_STYLES.proposed;
                return (
                  <tr key={leg.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-3 py-2">
                      {leg.source_url ? (
                        <a
                          href={leg.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-slate-200 hover:text-blue-400"
                        >
                          {leg.title}
                        </a>
                      ) : (
                        <span className="font-medium text-slate-200">{leg.title}</span>
                      )}
                      {leg.description && (
                        <div className="mt-0.5 text-[10px] text-slate-500">{leg.description}</div>
                      )}
                      {leg.source_name && (
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          Source: {leg.source_url ? (
                            <a href={leg.source_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                              {leg.source_name}
                            </a>
                          ) : (
                            leg.source_name
                          )}
                          {leg.source_reliability ? ` (${leg.source_reliability})` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{leg.body ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-400">
                      {leg.country_id ? (
                        <Link href={`/countries/${leg.country_id}`} className="hover:text-blue-400">
                          {leg.country_name ?? `Country ${leg.country_id}`}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${stageClass}`}>
                        {formatLabel(leg.stage)}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-500">{formatDateHuman(leg.expected_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
