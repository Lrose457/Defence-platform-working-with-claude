import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ageHoursSince } from "@/lib/atlas/tleCache";
import WorldAtlas from "@/components/atlas/WorldAtlas";
import type {
  AtlasConflict,
  AtlasInstallation,
  HybridWarfareIncident,
} from "@/components/atlas/atlasData";

export const metadata = {
  title: "Global Atlas — Defence Intelligence Platform",
  description:
    "Interactive world atlas of defence intelligence: budgets, spheres of influence, conflicts, military installations and orbiting satellites.",
};

async function getBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  const headersList = await headers();
  const host =
    headersList.get("host") || headersList.get("x-forwarded-host") || "localhost:3000";
  const proto =
    headersList.get("x-forwarded-proto") ||
    (process.env.NODE_ENV === "development" ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function MapPage() {
  const supabase = await createClient();

  const [countriesR, budgetsR, conflictsOverviewR, installationsR, statusR, hybridR] =
    await Promise.all([
      supabase.from("countries").select("id, name, iso_code, region").order("name"),
      supabase.from("latest_budget_overview").select("country_id, year, amount_usd"),
      supabase
        .from("country_conflict_overview")
        .select("country_id, conflict_id, name, intensity_level")
        .limit(500),
      supabase
        .from("military_installations")
        .select("id, name, type, lat, lng, status, notes, source_url, country_id, countries ( name )")
        .limit(500),
      /* Tiny status call only — satellite elements themselves load
       * client-side in SatelliteLayer (lazy chunk, direct fetch), keeping
       * ~660 TLE records out of the server-rendered HTML. */
      fetch(`${await getBaseUrl()}/api/satellites/status`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      /* Hybrid-warfare incidents (20261010 migration): verified rows +
       * live 'possible' candidates. Degrades to an empty layer with an
       * on-map hint until the migration is applied. */
      supabase
        .from("atlas_hybrid_warfare")
        .select(
          "id, country_id, attacked_iso3, attacked_name, target_type, lat, lng," +
            " title, summary, definition_clause, target_description, government_response," +
            " domains, confidence_score, status, first_seen_at, last_seen_at, source_url",
        )
        .limit(500),
    ]);

  /* The conflict overview view needs the patch02 migration. Until it is
   * applied, fall back to a direct join of the base tables so the atlas
   * still lights up when HIIK data is replayed. */
  let conflicts: AtlasConflict[] = (conflictsOverviewR.data ?? []) as AtlasConflict[];
  if (conflictsOverviewR.error) {
    const [conflictsR, partiesR] = await Promise.all([
      supabase.from("conflicts").select("id, name, intensity_level"),
      supabase.from("conflict_parties").select("conflict_id, country_id"),
    ]);
    const conflictById = new Map(
      (conflictsR.data ?? []).map((c) => [c.id, c]),
    );
    conflicts = (partiesR.data ?? [])
      .map((p) => {
        const c = conflictById.get(p.conflict_id);
        return c
          ? {
              country_id: p.country_id,
              conflict_id: c.id,
              name: c.name,
              intensity_level: c.intensity_level,
            }
          : null;
      })
      .filter((v): v is AtlasConflict => v !== null);
  }

  const incidents: HybridWarfareIncident[] = (hybridR.data ?? []) as unknown as HybridWarfareIncident[];
  const incidentsError = hybridR.error ? "run the 20261010 migration" : null;

  const installations: AtlasInstallation[] = (installationsR.data ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    type: i.type,
    lat: Number(i.lat),
    lng: Number(i.lng),
    status: i.status,
    notes: i.notes,
    source_url: i.source_url,
    country_id: i.country_id,
    country_name:
      (Array.isArray(i.countries)
        ? ((i.countries as { name?: string }[])[0]?.name ?? null)
        : ((i.countries as { name?: string } | null)?.name ?? null)),
  }));

  const status = statusR as { count: number; timestamp: number | null } | null;
  const tleAgeHours = ageHoursSince(status?.timestamp ?? null);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Global Atlas</h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            {countriesR.data?.length ?? 0} tracked countries · {installations.length} installations ·{" "}
            {status?.count ?? "—"} satellites · {conflicts.length} conflict links ·{" "}
            {incidents.length} hybrid incidents
            {tleAgeHours != null && (
              <span
                title="Age of the cached CelesTrak elements (hourly refresh agent)"
                className={`ml-2 rounded border px-1.5 py-0.5 normal-case ${
                  tleAgeHours <= 7
                    ? "border-emerald-800 text-emerald-500"
                    : tleAgeHours <= 24
                      ? "border-amber-800 text-amber-500"
                      : "border-red-800 text-red-500"
                }`}
              >
                TLE {tleAgeHours}h old
              </span>
            )}
          </p>
        </div>
      </div>

      <WorldAtlas
        countries={countriesR.data ?? []}
        budgets={budgetsR.data ?? []}
        conflicts={conflicts}
        installations={installations}
        installationsError={installationsR.error ? "run the 20261001 migration" : null}
        incidents={incidents}
        incidentsError={incidentsError}
      />
    </div>
  );
}
