import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import WorldAtlas from "@/components/atlas/WorldAtlas";
import type {
  AtlasConflict,
  AtlasInstallation,
  AtlasSatellite,
} from "@/components/atlas/atlasData";

export const metadata = {
  title: "Global Atlas — Defence Intelligence Platform",
  description:
    "Interactive world atlas of defence intelligence: budgets, spheres of influence, conflicts, military installations and orbiting satellites.",
};

interface SatellitesApiResponse {
  data: { name: string; line1: string; line2: string; group: string }[];
  error?: string;
}

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

  const [countriesR, budgetsR, conflictsOverviewR, installationsR] = await Promise.all([
    supabase.from("countries").select("id, name, iso_code, region").order("name"),
    supabase
      .from("budgets")
      .select("country_id, year, amount_usd")
      .order("year", { ascending: false })
      .limit(2000),
    supabase
      .from("country_conflict_overview")
      .select("country_id, conflict_id, name, intensity_level")
      .limit(500),
    supabase
      .from("military_installations")
      .select("id, name, type, lat, lng, status, notes, source_url, country_id, countries ( name )")
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

  /* Satellite elements via the cached internal proxy. The route caches
   * in module memory for 6h, so this fetch must not add its own cache —
   * a long cache here would serve stale records across deploys. */
  let satellites: AtlasSatellite[] | null = null;
  let satellitesError: string | null = null;
  try {
    const base = await getBaseUrl();
    const res = await fetch(`${base}/api/satellites`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const json = (await res.json()) as SatellitesApiResponse;
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    satellites = (json.data ?? []) as AtlasSatellite[];
  } catch (err) {
    satellitesError = err instanceof Error ? err.message : "elements unavailable";
    satellites = null;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Global Atlas</h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            {countriesR.data?.length ?? 0} tracked countries · {installations.length} installations ·{" "}
            {satellites ? satellites.length : "—"} satellites · {conflicts.length} conflict links
          </p>
        </div>
      </div>

      <WorldAtlas
        countries={countriesR.data ?? []}
        budgets={budgetsR.data ?? []}
        conflicts={conflicts}
        satellites={satellites}
        satellitesError={satellitesError}
        installations={installations}
        installationsError={installationsR.error ? "run the 20261001 migration" : null}
      />
    </div>
  );
}
