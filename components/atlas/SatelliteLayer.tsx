"use client";

/**
 * Animated satellite layer: propagates each object's orbital elements
 * (SGP4 via satellite.js) to its current sub-satellite point and animates
 * movement with requestAnimationFrame. Hover a marker for operator,
 * role and programme detail.
 *
 * satellite.js is imported lazily on first mount (it is the atlas's
 * heaviest dependency) and TLE elements are fetched from /api/satellites
 * directly, keeping both out of the server-rendered HTML.
 *
 * Positions are real propagation; attribution (country/role) is curated —
 * see lib/atlas/satelliteCatalog.ts.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoProjection } from "d3-geo";
import type { AtlasSatellite } from "@/components/atlas/atlasData";

type SatelliteLib = typeof import("satellite.js");
type Satrec = ReturnType<SatelliteLib["twoline2satrec"]>;

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

/* Loaded once by ensureLib(); null until then. */
let satlib: SatelliteLib | null = null;

/** Lazily import satellite.js and validate its exports (v5 namespace). */
async function ensureLib(): Promise<SatelliteLib | null> {
  if (satlib) return satlib;
  try {
    const lib = await import("satellite.js");
    if (typeof lib.twoline2satrec !== "function" || typeof lib.propagate !== "function") {
      console.error("[atlas] satellite.js failed to load its exports");
      return null;
    }
    satlib = lib;
    return lib;
  } catch {
    console.error("[atlas] satellite.js chunk failed to load");
    return null;
  }
}

interface PropagatedSat extends AtlasSatellite {
  satrec: Satrec;
  color: string;
  /** Upcoming ground track (lng/lat pairs), sampled every few minutes. */
  trail: [number, number][];
}

const TRAIL_MINUTES = 95; // ~one LEO orbit; GEO sats will trace a short arc
const TRAIL_STEP_MINUTES = 3;

/** Precompute the upcoming ground track for one object. */
function computeTrail(lib: SatelliteLib, satrec: Satrec): [number, number][] {
  const trail: [number, number][] = [];
  const start = Date.now();
  for (let m = 0; m <= TRAIL_MINUTES; m += TRAIL_STEP_MINUTES) {
    try {
      const date = new Date(start + m * 60_000);
      const pv = lib.propagate(satrec, date);
      const pos = pv?.position;
      if (!pos || typeof pos === "boolean") continue;
      const gd = lib.eciToGeodetic(pos, lib.gstime(date));
      const lat = lib.degreesLat(gd.latitude);
      const lng = lib.degreesLong(gd.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      trail.push([lng, lat]);
    } catch {
      /* skip un-propagatable sample */
    }
  }
  return trail;
}

/* Module-level cache for the parsed+propagated satellite set. The layer
 * unmounts whenever the user toggles the satellites OFF/ON; without this,
 * every toggle re-fetches and re-runs ~21k SGP4 trail propagations. Keyed
 * by response timestamp so a fresh TLE refresh does invalidate it. */
let parsedCache: { key: string; sats: PropagatedSat[] } | null = null;

function parse(lib: SatelliteLib, source: AtlasSatellite[], cacheKey: string): PropagatedSat[] {
  if (parsedCache && parsedCache.key === cacheKey) return parsedCache.sats;
  const parsed: PropagatedSat[] = [];
  for (const sat of source) {
    try {
      const satrec = lib.twoline2satrec(sat.line1, sat.line2);
      const role = sat.role ?? "Civil / other";
      parsed.push({
        ...sat,
        satrec,
        role,
        country: sat.country ?? "Unattributed",
        iso3: sat.iso3 ?? "",
        color: roleColor(role),
        trail: computeTrail(lib, satrec),
      });
    } catch {
      /* Malformed TLE — skip the object. */
    }
  }
  parsedCache = { key: cacheKey, sats: parsed };
  return parsed;
}

export default function SatelliteLayer({
  projection,
  zoom,
}: {
  projection: GeoProjection;
  zoom: number;
}) {
  const [sats, setSats] = useState<PropagatedSat[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);

  /* Load elements + satellite.js on mount. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lib = await ensureLib();
      if (!lib || cancelled) return;
      try {
        const res = await fetch("/api/satellites", { headers: { Accept: "application/json" } });
        const json = (await res.json()) as {
          data?: AtlasSatellite[];
          timestamp?: number;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        if (cancelled) return;
        setSats(
          parse(lib, json.data ?? [], String(json.timestamp ?? "no-timestamp")),
        );
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "elements unavailable");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (!sats || !satlib) return [];
    const date = new Date(now);
    const gmst = satlib.gstime(date);
    const out: { sat: PropagatedSat; x: number; y: number }[] = [];
    for (const sat of sats) {
      try {
        const pv = satlib.propagate(sat.satrec, date);
        const pos = pv?.position;
        /* v5 types position as `true | EciVec3` — true means propagation failed. */
        if (!pos || typeof pos === "boolean") continue;
        const gd = satlib.eciToGeodetic(pos, gmst);
        const lat = satlib.degreesLat(gd.latitude);
        const lng = satlib.degreesLong(gd.longitude);
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

  if (loadError && points.length === 0) {
    return (
      <g>
        <text x={20} y={70} fill="#f59e0b" fontSize={11}>
          Satellite layer unavailable: {loadError}
        </text>
      </g>
    );
  }

  return (
    <g>
      {/* Ground tracks: one faint polyline per object, drawn beneath markers. */}
      {sats?.map((sat) => {
        if (sat.trail.length < 2) return null;
          const d = sat.trail
            .map(([lng, lat], i) => {
              const xy = projection([lng, lat]);
              return xy ? `${i === 0 ? "M" : "L"}${xy[0].toFixed(1)},${xy[1].toFixed(1)}` : null;
            })
            .filter((seg): seg is string => seg !== null)
            .join("");
          if (!d) return null;
          return (
            <path
              key={`trail-${sat.line1.slice(2, 7)}`}
              d={d}
              fill="none"
              stroke={sat.color}
              strokeOpacity={0.18}
              strokeWidth={0.7 / zoom}
              pointerEvents="none"
            />
          );
        })}
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
      {hovered && <HoverCard sat={hovered} projection={projection} />}
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
  let x = 0;
  let y = 0;
  try {
    if (satlib) {
      const date = new Date();
      const pv = satlib.propagate(sat.satrec, date);
      const pos = pv?.position;
      if (pos && typeof pos !== "boolean") {
        const gd = satlib.eciToGeodetic(pos, satlib.gstime(date));
        const xy = projection([satlib.degreesLong(gd.longitude), satlib.degreesLat(gd.latitude)]);
        if (xy) {
          x = xy[0];
          y = xy[1];
        }
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
