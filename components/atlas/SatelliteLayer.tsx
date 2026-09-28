"use client";

/**
 * Animated satellite layer: propagates each object's orbital elements
 * (SGP4 via satellite.js) to its current sub-satellite point and animates
 * movement with requestAnimationFrame. Hover a marker for operator,
 * role and programme detail.
 *
 * Positions are real propagation; attribution (country/role) is curated —
 * see lib/atlas/satelliteCatalog.ts.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as satellite from "satellite.js";
import type { GeoProjection } from "d3-geo";
import type { AtlasSatellite } from "@/components/atlas/atlasData";

const TYPE_COLORS: Record<string, string> = {
  "Early warning": "#f59e0b",
  Reconnaissance: "#ef4444",
  Navigation: "#22d3ee",
  Communications: "#a78bfa",
  "Space domain awareness": "#f472b6",
  "Missile tracking": "#fb7185",
  Weather: "#38bdf8",
  "Crewed station / civil": "#4ade80",
};

function roleColor(role: string | undefined): string {
  for (const key of Object.keys(TYPE_COLORS)) {
    if (role?.startsWith(key)) return TYPE_COLORS[key];
  }
  return "#94a3b8";
}

interface PropagatedSat extends AtlasSatellite {
  satrec: ReturnType<typeof satellite.twoline2satrec>;
  color: string;
}

export default function SatelliteLayer({
  satellites,
  error,
  projection,
  zoom,
}: {
  satellites: AtlasSatellite[] | null;
  error: string | null;
  projection: GeoProjection;
  zoom: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);

  /* Pre-parse TLEs once. Namespace import: CJS interop for named imports
   * is unreliable under bundlers, so access via the namespace object. */
  const sats = useMemo<PropagatedSat[] | null>(() => {
    if (!satellites) return null;
    if (
      typeof satellite.twoline2satrec !== "function" ||
      typeof satellite.propagate !== "function"
    ) {
      console.error("[atlas] satellite.js failed to load its exports");
      return [];
    }
    const parsed: PropagatedSat[] = [];
    for (const sat of satellites) {
      try {
        const satrec = satellite.twoline2satrec(sat.line1, sat.line2);
        const role = sat.role ?? "Civil / other";
        parsed.push({
          ...sat,
          satrec,
          role,
          country: sat.country ?? "Unattributed",
          iso3: sat.iso3 ?? "",
          color: roleColor(role),
        });
      } catch {
        /* Malformed TLE — skip the object. */
      }
    }
    return parsed;
  }, [satellites]);

  /* Animation loop (~2 updates per second — plenty for map-scale motion). */
  useEffect(() => {
    if (!sats || sats.length === 0) return;
    const tick = (t: number) => {
      if (t - lastTickRef.current > 500) {
        lastTickRef.current = t;
        setNow(Date.now());
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [sats]);

  const [hovered, setHovered] = useState<PropagatedSat | null>(null);

  const points = useMemo(() => {
    if (!sats) return [];
    const date = new Date(now);
    const gmst = satellite.gstime(date);
    const out: { sat: PropagatedSat; x: number; y: number }[] = [];
    for (const sat of sats) {
      try {
        const pv = satellite.propagate(sat.satrec, date);
        const pos = pv?.position;
        /* v5 types position as `true | EciVec3` — true means propagation failed. */
        if (!pos || typeof pos === "boolean") continue;
        const gd = satellite.eciToGeodetic(pos, gmst);
        const lat = satellite.degreesLat(gd.latitude);
        const lng = satellite.degreesLong(gd.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const xy = projection([lng, lat]);
        if (!xy) continue;
        out.push({ sat, x: xy[0], y: xy[1] });
      } catch {
        /* Propagation error (decayed etc.) — skip. */
      }
    }
    return out;
  }, [sats, now, projection]);

  if (error && points.length === 0) {
    return (
      <g>
        <text x={20} y={70} fill="#f59e0b" fontSize={11}>
          Satellite layer unavailable: {error}
        </text>
      </g>
    );
  }

  return (
    <g>
      {points.map(({ sat, x, y }) => (
        <circle
          key={`${sat.line1.slice(2, 7)}`}
          cx={x}
          cy={y}
          r={2.2 / zoom}
          fill={sat.color}
          fillOpacity={0.85}
          stroke="none"
          className="cursor-pointer"
          onMouseEnter={() => setHovered(sat)}
          onMouseLeave={() => setHovered(null)}
        />
      ))}
      {hovered && (
        <HoverCard sat={hovered} projection={projection} />
      )}
    </g>
  );
}

function HoverCard({
  sat,
  projection,
}: {
  sat: PropagatedSat;
  projection: GeoProjection;
}) {
  /* Anchor near the satellite's current point. */
  const date = new Date();
  const gmst = satellite.gstime(date);
  let x = 0;
  let y = 0;
  try {
    const pv = satellite.propagate(sat.satrec, date);
    const pos = pv?.position;
    if (pos && typeof pos !== "boolean") {
      const gd = satellite.eciToGeodetic(pos, gmst);
      const xy = projection([satellite.degreesLong(gd.longitude), satellite.degreesLat(gd.latitude)]);
      if (xy) {
        x = xy[0];
        y = xy[1];
      }
    }
  } catch {
    /* fall through with 0,0 */
  }
  const flip = x > 640;

  return (
    <foreignObject x={flip ? x - 250 : x + 8} y={Math.max(0, y - 40)} width={242} height={110}>
      <div className="rounded border border-slate-700 bg-slate-950/95 p-2 text-[11px] shadow-xl">
        <p className="font-medium text-slate-100">{sat.name}</p>
        <p className="text-[10px] text-slate-400">
          <span style={{ color: sat.color }}>●</span> {sat.role} · {sat.country}
        </p>
        {sat.iso3 && (
          <p className="text-[10px] text-slate-500">Operator: {sat.country} ({sat.iso3})</p>
        )}
        <p className="text-[10px] text-slate-500">
          Position propagated (SGP4) · attribution curated
        </p>
      </div>
    </foreignObject>
  );
}
