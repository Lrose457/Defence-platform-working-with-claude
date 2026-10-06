/** Shared types and world-map data loading for the global atlas. */

import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import { ISO_NUMERIC_TO_ALPHA3 } from "@/lib/atlas/isoNumericToAlpha3";

import worldTopo from "../../public/atlas/countries-110m.json";

export interface AtlasCountry {
  id: number;
  name: string;
  iso_code: string | null;
  region: string | null;
}

export interface AtlasBudget {
  country_id: number;
  amount_usd: number | null;
  year: number | null;
}

export interface AtlasConflict {
  country_id: number;
  conflict_id: number;
  name: string;
  intensity_level: number | null;
}

export interface AtlasSatellite {
  name: string;
  line1: string;
  line2: string;
  country: string;
  iso3: string;
  role: string;
  group: string;
}

export interface AtlasInstallation {
  id: number;
  name: string;
  type: string;
  lat: number;
  lng: number;
  status: string | null;
  notes: string | null;
  source_url: string | null;
  country_id: number;
  country_name: string | null;
}

/** Row of the `atlas_hybrid_warfare` view (20261010 migration):
 * verified incidents from the longitudinal table unioned with live
 * 'possible' candidates still pending review in ingestion_queue. */
export interface HybridWarfareIncident {
  id: number;
  country_id: number | null;
  attacked_iso3: string | null;
  attacked_name: string | null;
  target_type: "military" | "civilian" | "dual" | null;
  lat: number | null;
  lng: number | null;
  title: string;
  summary: string | null;
  definition_clause: string | null;
  target_description: string | null;
  government_response: string | null;
  domains: string[] | null;
  confidence_score: number | null;
  status: "possible" | "verified";
  first_seen_at: string | null;
  last_seen_at: string | null;
  source_url: string | null;
}

/** Natural Earth country feature joined to its ISO alpha3 code. */
export type WorldFeature = Feature<Geometry, { name?: string }> & {
  id?: string | number;
};

export interface JoinedFeature {
  feature: WorldFeature;
  alpha3: string | null;
}

type TopoGeometry = { id?: string | number; properties?: { name?: string } };

/** Vendored Natural Earth 110m topology → joined feature list. */
export function loadWorldFeatures(): JoinedFeature[] {
  const topo = worldTopo as unknown as Topology;
  const collection = feature(
    topo,
    topo.objects.countries,
  ) as unknown as FeatureCollection<Geometry, { name?: string }>;

  return collection.features.map((f) => {
    const id = (f as unknown as TopoGeometry).id;
    return {
      feature: f as WorldFeature,
      alpha3: ISO_NUMERIC_TO_ALPHA3[String(id ?? "")] ?? null,
    };
  });
}
