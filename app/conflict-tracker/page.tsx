import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateHuman } from "@/lib/format";
import { IntensityBadge, IntensityLegend } from "@/components/IntensityBadge";
import GlobalDefenseMap from "@/components/GlobalDefenseMap";

export const metadata = {
  title: "Conflict Tracker — Defence Intelligence Platform",
  description: "Global conflict tracking with intensity levels and mapping.",
};

export default async function ConflictTrackerPage() {
  const supabase = await createClient();

  const [{ data: conflicts, error }, { count }] = await Promise.all([
    supabase
      .from("conflict_overview")
      .select(
        "id, name, region, status, intensity_level, party_count, incident_count, latest_incident_date",
      )
      .order("intensity_level", { ascending: false, nullsFirst: false })
      .order("latest_incident_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("conflicts")
      .select("id", { count: "exact", head: true }),
  ]);

  const rows = conflicts ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-end gap-3 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Conflict Tracker</h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Global conflict intelligence · {rows.length} tracked conflicts
          </p>
        </div>
        <div className="px-3 py-1 rounded bg-red-900/20 border border-red-800 text-red-400 text-[10px] font-mono uppercase tracking-widest">
          Reviewed ingestion only
        </div>
      </div>

      {/* Same component and projection as /countries/map, opened on the
          conflict layer, so the two pages are two entry points into one map
          rather than two maps that can disagree. */}
      <GlobalDefenseMap
        initialMetric="conflicts"
        emptyHint={{
          conflicts:
            "No conflict records have been reviewed into the platform yet. Conflict data enters through the ingestion review queue — including the HIIK 2025 payload and ACLED events once an API key is configured — so this layer is empty by design, not by error.",
        }}
      />


      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {error ? (
            <div className="rounded border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-200">
              Conflict records are being provisioned. They will appear here once
              ingested and reviewed.
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
              No conflicts are currently tracked in the database. Conflict
              attribution (tactical analysis, hotspots, attrition) is only shown
              when sourced records exist.
            </div>
          ) : (
            rows.map((conflict) => (
              <div
                key={conflict.id}
                className="space-y-3 rounded border border-slate-800 bg-slate-900/50 overflow-hidden"
              >
                <div className="flex flex-wrap justify-between items-center gap-2 bg-slate-900 border-b border-slate-800 px-4 py-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
                      <Link href={`/conflicts/${conflict.id}`} className="hover:text-blue-400">
                        {conflict.name || `Conflict ${conflict.id}`}
                      </Link>
                    </h2>
                    <IntensityBadge level={conflict.intensity_level} />
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        conflict.status === "Active"
                          ? "bg-red-900/40 text-red-400 border border-red-800"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {conflict.status ?? "Unknown"}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-slate-500">
                    {conflict.region || "Region not recorded"} {"//"} latest incident:{" "}
                    {formatDateHuman(conflict.latest_incident_date)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-6 px-4 pb-3 text-[11px] font-mono text-slate-500">
                  <span>Parties: {conflict.party_count ?? 0}</span>
                  <span>Incidents: {conflict.incident_count ?? 0}</span>
                  <Link href={`/conflicts/${conflict.id}`} className="text-blue-500 hover:text-blue-400">
                    Open dossier →
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-4">
          <IntensityLegend />
          <section className="rounded border border-slate-800 bg-slate-900/50 p-4 text-[11px] leading-5 text-slate-500">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-300">
              Data & methodology
            </h2>
            <p className="mt-2">
              Conflict records come from reviewed ingestion of open event data.
              Intensity levels are platform assessments following the HIIK
              methodology and are shown alongside incident counts and party
              data — never as a standalone headline number.
            </p>
            <p className="mt-2">
              Total conflict records in database: {count ?? 0}. Only conflicts
              with reviewed source records are displayed.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
