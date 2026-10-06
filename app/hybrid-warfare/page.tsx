import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import HybridWarfareTracker, {
  type TrackedHybridIncident,
} from "@/components/HybridWarfareTracker";

export const metadata = {
  title: "Hybrid Warfare Tracker — Defence Intelligence Platform",
  description:
    "Longitudinal tracking of possible hybrid-warfare incidents harvested from European public broadcasters, reviewed and catalogued by attacked nation and target type.",
};

const INCIDENT_COLUMNS =
  "id, country_id, attacked_iso3, target_type, lat, lng, title, summary," +
  " definition_clause, target_description, government_response, domains," +
  " confidence_score, status, first_seen_at, last_seen_at, source_url";

export default async function HybridWarfarePage() {
  const supabase = await createClient();

  /* Two reads, merged below:
   *  - hybrid_warfare_incidents: the longitudinal catalogue (possible /
   *    verified / dropped — dropped stays for the audit trail).
   *  - atlas_hybrid_warfare: adds live 'possible' candidates still pending
   *    in the ingestion queue (the view suppresses dropped rows). */
  const [tableR, viewR] = await Promise.all([
    supabase
      .from("hybrid_warfare_incidents")
      .select(`${INCIDENT_COLUMNS}, countries ( name )`)
      .order("first_seen_at", { ascending: false, nullsFirst: false })
      .limit(1000),
    supabase
      .from("atlas_hybrid_warfare")
      .select(`${INCIDENT_COLUMNS}, attacked_name`)
      .order("first_seen_at", { ascending: false, nullsFirst: false })
      .limit(1000),
  ]);

  type RawRow = Record<string, unknown> & {
    id: number;
    status: string;
    source_url?: string | null;
    countries?: { name?: string } | { name?: string }[] | null;
  };

  const tableRows = ((tableR.data ?? []) as unknown as RawRow[]).map((r) => ({
    ...r,
    attacked_name:
      (Array.isArray(r.countries)
        ? r.countries[0]?.name
        : r.countries?.name) ?? null,
    status: r.status as TrackedHybridIncident["status"],
  })) as unknown as TrackedHybridIncident[];

  /* If the table query itself failed (migration not applied), fall back to
   * whatever the view returned so a partial environment still renders. */
  const tableFailed = Boolean(tableR.error);
  const seenIds = new Set(tableRows.map((r) => r.id));
  const seenUrls = new Set(
    tableRows.map((r) => r.source_url).filter((u): u is string => Boolean(u)),
  );

  const pendingRows = ((viewR.data ?? []) as unknown as RawRow[])
    .filter(
      (r) =>
        (tableFailed || r.status === "possible") &&
        !seenIds.has(r.id) &&
        !(r.source_url && seenUrls.has(r.source_url)),
    )
    .map((r) => ({
      ...r,
      target_type: (r.target_type ?? null) as TrackedHybridIncident["target_type"],
      status: r.status as TrackedHybridIncident["status"],
    })) as unknown as TrackedHybridIncident[];

  const incidents = [...tableRows, ...pendingRows].sort((a, b) =>
    (b.first_seen_at ?? "").localeCompare(a.first_seen_at ?? ""),
  );

  const loadFailed = Boolean(tableR.error && viewR.error);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-end gap-3 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Hybrid Warfare Tracker
          </h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Longitudinal incident database · {incidents.length} records ·
            harvested from European public broadcasters · analyst-reviewed
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/map"
            className="rounded border border-slate-700 px-3 py-1 text-[11px] font-mono text-slate-400 hover:text-slate-200"
          >
            View on atlas →
          </Link>
          <span className="rounded bg-purple-900/20 border border-purple-800 px-3 py-1 text-purple-400 text-[10px] font-mono uppercase tracking-widest">
            Possible → Verified / Dropped
          </span>
        </div>
      </div>

      {loadFailed ? (
        <div className="rounded border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-200">
          Hybrid-warfare records are being provisioned. The 20261010 migration
          (longitudinal table + atlas view) has not been applied to this
          environment yet — incidents will appear here once it is applied and
          the nightly harvester runs.
        </div>
      ) : incidents.length === 0 ? (
        <div className="rounded border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
          No hybrid-warfare incidents have been harvested yet. The nightly
          pipeline classifies items from European public broadcasters&apos;
          newsfeeds and queues candidates for analyst review; reviewed records
          then appear here and on the global atlas.
        </div>
      ) : (
        <HybridWarfareTracker incidents={incidents} />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded border border-slate-800 bg-slate-900/50 p-4 text-[11px] leading-5 text-slate-500">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-300">
            Definition (sources)
          </h2>
          <p className="mt-2">
            Classification follows citable official definitions rather than a
            private taxonomy:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>
              <span className="text-slate-300">NATO glossary / JP 3.20</span> —
              a blend of conventional and non-conventional means, coordinated
              across domains, kept at least partly deniable.
            </li>
            <li>
              <span className="text-slate-300">EU JOIN(2016) 18</span> — a broad
              range of means (diplomatic, information, cyber, economic,
              military, intelligence) employed in a coordinated manner while
              exploiting vulnerabilities.
            </li>
            <li>
              <span className="text-slate-300">EU HybNet / Hybrid CoE five
              tools</span> — armed force or proxy, information operations, cyber
              operations, economic/energy coercion, and political/governance
              interference, used in concert.
            </li>
          </ul>
        </section>

        <section className="rounded border border-slate-800 bg-slate-900/50 p-4 text-[11px] leading-5 text-slate-500">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-300">
            Label ladder
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>
              <span className="text-amber-400">Possible</span> — the rules
              engine found a blend of two or more domains plus vulnerability
              exploitation (or a single domain worth a second look). Queued in
              the ingestion review queue; shown live on the atlas as a hollow
              marker.
            </li>
            <li>
              <span className="text-emerald-400">Verified</span> — an analyst
              approved the record (corroborated / enriched). Rendered filled on
              the atlas.
            </li>
            <li>
              <span className="text-slate-400">Dropped</span> — disproven or
              rejected on review. Suppressed from the live map but retained
              here, so the dataset stays genuinely longitudinal.
            </li>
            <li>
              Not hybrid — rejected by the rules engine and never queued.
            </li>
          </ul>
        </section>

        <section className="rounded border border-slate-800 bg-slate-900/50 p-4 text-[11px] leading-5 text-slate-500">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-300">
            Pipeline &amp; caveats
          </h2>
          <p className="mt-2">
            A nightly harvester pulls RSS feeds from European public
            broadcasters (BBC, Deutsche Welle, France 24, ARD, ZDF, SVT) and
            classifies each item with a deterministic, unit-tested rules engine
            — no black-box model in the default path. Records enter the
            ingestion queue with <span className="font-mono">single_source</span>{" "}
            confidence and only reach this table after analyst review
            (/admin/ingestion).
          </p>
          <p className="mt-2">
            Attacked-nation attribution is a best-effort keyword scan and can
            mis-attribute to the acting state; broadcaster feeds rarely carry
            geocoordinates, so atlas markers sit on the attacked
            country&apos;s centroid. Government responses are recorded when a
            source reports them.
          </p>
        </section>
      </div>
    </div>
  );
}
