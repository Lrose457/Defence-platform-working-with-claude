"use client";

/**
 * Hybrid-warfare incident layer: one marker per incident, placed at its own
 * coordinates when known and otherwise at the attacked country's centroid.
 *
 * Markers are styled by target type (military / civilian / dual) and by
 * status: verified incidents render filled, live "possible" candidates
 * (still pending review) render hollow with a dashed ring. Co-located
 * incidents are spread on a golden-angle spiral so each stays hoverable.
 *
 * Hover reports container-pixel coordinates so the shared HTML overlay
 * panel in WorldAtlas tracks the cursor correctly at any rendered width
 * and under zoom/pan (an HTML overlay never scales with the SVG zoom,
 * unlike a foreignObject card).
 */

import Link from "next/link";
import type { GeoProjection } from "d3-geo";
import type { HybridWarfareIncident } from "@/components/atlas/atlasData";

/** Marker style per target type; shared with the WorldAtlas legend. */
export const HYBRID_TARGET_STYLE: Record<
  string,
  { color: string; glyph: string; label: string }
> = {
  military: { color: "#ef4444", glyph: "▲", label: "Military target" },
  civilian: { color: "#f59e0b", glyph: "●", label: "Civilian infrastructure" },
  dual: { color: "#a855f7", glyph: "◆", label: "Dual target" },
  unknown: { color: "#94a3b8", glyph: "?", label: "Unclassified target" },
};

/** ~137.5° — spreads stacked markers without visible alignment. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export default function HybridLayer({
  incidents,
  projection,
  zoom,
  centroidByIso,
  onHover,
  onLeave,
  error,
}: {
  incidents: HybridWarfareIncident[];
  projection: GeoProjection;
  zoom: number;
  centroidByIso: Map<string, { lat: number; lng: number }>;
  onHover: (incident: HybridWarfareIncident, x: number, y: number) => void;
  onLeave: () => void;
  error: string | null;
}) {
  if (incidents.length === 0 && error) {
    return (
      <g>
        <text x={20} y={104} fill="#f59e0b" fontSize={11}>
          Hybrid-warfare layer unavailable: {error}
        </text>
      </g>
    );
  }

  type Placed = { incident: HybridWarfareIncident; x: number; y: number };
  const placed: Placed[] = [];
  const seen = new Map<string, number>();

  for (const incident of incidents) {
    const centroid =
      incident.lat != null && incident.lng != null
        ? { lat: Number(incident.lat), lng: Number(incident.lng) }
        : incident.attacked_iso3
          ? (centroidByIso.get(incident.attacked_iso3.toUpperCase()) ?? null)
          : null;
    if (!centroid) continue;
    const xy = projection([centroid.lng, centroid.lat]);
    if (!xy) continue;

    /* Stack markers landing on the same projected point. */
    const key = `${xy[0].toFixed(2)},${xy[1].toFixed(2)}`;
    const idx = seen.get(key) ?? 0;
    seen.set(key, idx + 1);
    if (idx > 0) {
      const angle = idx * GOLDEN_ANGLE;
      const radius = (3 + 2.4 * Math.sqrt(idx)) / zoom;
      xy[0] += Math.cos(angle) * radius;
      xy[1] += Math.sin(angle) * radius;
    }
    placed.push({ incident, x: xy[0], y: xy[1] });
  }

  return (
    <g>
      {placed.map(({ incident, x, y }) => {
        const style =
          HYBRID_TARGET_STYLE[incident.target_type ?? "unknown"] ??
          HYBRID_TARGET_STYLE.unknown;
        const verified = incident.status === "verified";
        return (
          <circle
            key={`${incident.status}-${incident.id}`}
            cx={x}
            cy={y}
            r={5 / zoom}
            fill={verified ? style.color : "#020617"}
            fillOpacity={verified ? 0.85 : 0.9}
            stroke={style.color}
            strokeWidth={1.4 / zoom}
            strokeDasharray={
              verified ? undefined : `${2.4 / zoom} ${1.6 / zoom}`
            }
            className="cursor-pointer"
            onMouseEnter={(e) => {
              const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
              onHover(incident, e.clientX - rect.left, e.clientY - rect.top);
            }}
            onMouseLeave={onLeave}
          />
        );
      })}
    </g>
  );
}

/**
 * Hover panel body for one incident, rendered inside WorldAtlas's HTML
 * overlay (so it never scales with zoom). Mirrors AtlasTooltip's layout.
 */
export function HybridIncidentCard({
  incident,
}: {
  incident: HybridWarfareIncident;
}) {
  const style =
    HYBRID_TARGET_STYLE[incident.target_type ?? "unknown"] ??
    HYBRID_TARGET_STYLE.unknown;
  const verified = incident.status === "verified";
  const nation =
    incident.attacked_name ?? incident.attacked_iso3 ?? "Unknown target nation";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
            verified
              ? "border-emerald-700 bg-emerald-950/60 text-emerald-300"
              : "border-amber-700 bg-amber-950/60 text-amber-300"
          }`}
        >
          {verified ? "Verified" : "Possible"}
        </span>
        <span
          className="rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider"
          style={{ borderColor: style.color, color: style.color }}
        >
          {style.label}
        </span>
        {incident.confidence_score != null && (
          <span className="font-mono text-[9px] text-slate-500">
            {incident.confidence_score}%
          </span>
        )}
      </div>
      <p className="mt-2 text-xs font-medium leading-4 text-slate-100 line-clamp-3">
        {incident.title}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
        {nation}
      </p>
      {incident.summary && (
        <p className="mt-1 text-[10px] leading-4 text-slate-400 line-clamp-3">
          {incident.summary}
        </p>
      )}
      {incident.domains && incident.domains.length > 0 && (
        <p className="mt-1 text-[10px] text-slate-500">
          Domains: {incident.domains.join(", ")}
        </p>
      )}
      {incident.government_response && (
        <p className="mt-1 text-[10px] leading-4 text-slate-400 line-clamp-2">
          <span className="text-slate-500">Gov response: </span>
          {incident.government_response}
        </p>
      )}
      <div className="mt-2 flex items-center gap-3 text-[10px]">
        {incident.source_url && (
          <a
            href={incident.source_url}
            target="_blank"
            rel="noreferrer"
            className="pointer-events-auto text-blue-500 hover:text-blue-400"
          >
            Source →
          </a>
        )}
        <Link
          href="/hybrid-warfare"
          className="pointer-events-auto text-blue-500 hover:text-blue-400"
        >
          Open tracker →
        </Link>
      </div>
    </div>
  );
}
