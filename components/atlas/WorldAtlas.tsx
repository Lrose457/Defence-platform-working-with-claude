"use client";

/**
 * Global atlas: interactive Natural Earth world map.
 *
 * - Hover a country for its intelligence snapshot (sphere of influence,
 *   latest budget, tracked conflicts) and click through to its profile.
 * - Toggleable satellite layer (SGP4-propagated) and military-installation
 *   layer (sourced bases, ports, airfields).
 * - Shading is data-driven: budget amount tints tracked countries; conflict
 *   involvement turns a country red. No hardcoding.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { geoNaturalEarth1, geoPath, geoGraticule10 } from "d3-geo";
import type { GeoProjection } from "d3-geo";
import SatelliteLayer from "@/components/atlas/SatelliteLayer";
import InstallationLayer, {
  INSTALLATION_TYPE_STYLE,
} from "@/components/atlas/InstallationLayer";
import AtlasTooltip, { type TrackedInfo } from "@/components/atlas/AtlasTooltip";
import {
  loadWorldFeatures,
  type AtlasCountry,
  type AtlasBudget,
  type AtlasConflict,
  type AtlasSatellite,
  type AtlasInstallation,
  type JoinedFeature,
} from "@/components/atlas/atlasData";

const WIDTH = 960;
const HEIGHT = 500;

const worldFeatures: JoinedFeature[] = loadWorldFeatures();

export interface WorldAtlasProps {
  countries: AtlasCountry[];
  budgets: AtlasBudget[];
  conflicts: AtlasConflict[];
  satellites: AtlasSatellite[] | null;
  satellitesError: string | null;
  installations: AtlasInstallation[];
  installationsError: string | null;
}

export default function WorldAtlas({
  countries,
  budgets,
  conflicts,
  satellites,
  satellitesError,
  installations,
  installationsError,
}: WorldAtlasProps) {
  const router = useRouter();

  /* Zoom / pan */
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const dragRef = useRef<{ px: number; py: number } | null>(null);
  const draggedRef = useRef(false);

  /* Hover + layers */
  const [hover, setHover] = useState<{ jf: JoinedFeature; x: number; y: number } | null>(null);
  const [showSatellites, setShowSatellites] = useState(true);
  const [showInstallations, setShowInstallations] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  /* ── Data joins (all derived from props — nothing hardcoded) ── */

  const countryByIso = useMemo(() => {
    const map = new Map<string, AtlasCountry>();
    for (const c of countries) {
      if (c.iso_code) map.set(c.iso_code.toUpperCase(), c);
    }
    return map;
  }, [countries]);

  const latestBudgetByCountry = useMemo(() => {
    const map = new Map<number, { amount: number | null; year: number | null }>();
    for (const b of budgets) {
      const cur = map.get(b.country_id);
      if (!cur || (b.year ?? 0) > (cur.year ?? 0)) {
        map.set(b.country_id, { amount: b.amount_usd, year: b.year });
      }
    }
    return map;
  }, [budgets]);

  const conflictsByCountry = useMemo(() => {
    const map = new Map<number, AtlasConflict[]>();
    for (const c of conflicts) {
      const list = map.get(c.country_id) ?? [];
      list.push(c);
      map.set(c.country_id, list);
    }
    return map;
  }, [conflicts]);

  const maxBudget = useMemo(
    () => Math.max(...budgets.map((b) => b.amount_usd ?? 0), 1),
    [budgets],
  );

  const installationTypes = useMemo(
    () => [...new Set(installations.map((i) => i.type))].sort(),
    [installations],
  );

  /* Per-type stats (site count + distinct host countries) for the filter
   * options and legend. */
  const perTypeStats = useMemo(() => {
    const map = new Map<string, { sites: number; countries: number }>();
    const byType = new Map<string, Set<number>>();
    for (const inst of installations) {
      map.set(inst.type, {
        sites: (map.get(inst.type)?.sites ?? 0) + 1,
        countries: 0,
      });
      const set = byType.get(inst.type) ?? new Set<number>();
      set.add(inst.country_id);
      byType.set(inst.type, set);
    }
    for (const [type, set] of byType) {
      map.get(type)!.countries = set.size;
    }
    return map;
  }, [installations]);

  const typeLabel = (type: string) =>
    INSTALLATION_TYPE_STYLE[type]?.label ?? type.replaceAll("_", " ");

  const filteredInstallations = useMemo(
    () =>
      typeFilter === "all"
        ? installations
        : installations.filter((i) => i.type === typeFilter),
    [installations, typeFilter],
  );

  const track = useCallback(
    (jf: JoinedFeature): TrackedInfo | null => {
      if (!jf.alpha3) return null;
      const country = countryByIso.get(jf.alpha3);
      if (!country) return null;
      return {
        country,
        budget: latestBudgetByCountry.get(country.id),
        conflicts: conflictsByCountry.get(country.id) ?? [],
        alpha3: jf.alpha3,
      };
    },
    [countryByIso, latestBudgetByCountry, conflictsByCountry],
  );

  /* ── Projection & paths ──────────────────────────────────── */

  const projection: GeoProjection = useMemo(
    () =>
      geoNaturalEarth1().fitExtent(
        [
          [8, 8],
          [WIDTH - 8, HEIGHT - 8],
        ],
        { type: "Sphere" },
      ),
    [],
  );
  const path = useMemo(() => geoPath(projection), [projection]);

  const rendered = useMemo(
    () => worldFeatures.map((jf) => ({ jf, d: path(jf.feature) ?? "" })),
    [path],
  );  const graticulePath = useMemo(() => path(geoGraticule10()) ?? "", [path]);

  /* ── Interaction ─────────────────────────────────────────── */

  const handleCountryMove = (e: React.MouseEvent<SVGPathElement>, jf: JoinedFeature) => {
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    /* Map client coords into viewBox space so the panel tracks zoom. */
    setHover({
      jf,
      x: ((e.clientX - rect.left) / rect.width) * WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
    });
  };

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    setTransform((t) => ({
      ...t,
      k: Math.min(8, Math.max(1, t.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15))),
    }));
  }, []);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    dragRef.current = { px: e.clientX, py: e.clientY };
    draggedRef.current = false;
  };

  const handlePan = (e: React.MouseEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.px;
    const dy = e.clientY - drag.py;
    if (dx === 0 && dy === 0) return;
    draggedRef.current = true;
    dragRef.current = { px: e.clientX, py: e.clientY };
    setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const handleCountryClick = (jf: JoinedFeature) => {
    if (draggedRef.current) return; /* drag, not click */
    const info = track(jf);
    if (info) router.push(`/countries/${info.country.id}`);
  };

  /* ── Render ──────────────────────────────────────────────── */

  const hoverInfo = hover ? track(hover.jf) : null;
  const hoverName = hover
    ? (hover.jf.feature.properties?.name ?? "Unknown")
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => setShowSatellites((v) => !v)}
          aria-pressed={showSatellites}
          className={`rounded border px-2 py-1 font-mono transition-colors ${
            showSatellites
              ? "border-cyan-700 bg-cyan-950/50 text-cyan-300"
              : "border-slate-700 text-slate-400"
          }`}
        >
          🛰 Satellites {showSatellites ? "ON" : "OFF"}
        </button>
        <button
          type="button"
          onClick={() => setShowInstallations((v) => !v)}
          aria-pressed={showInstallations}
          className={`rounded border px-2 py-1 font-mono transition-colors ${
            showInstallations
              ? "border-amber-700 bg-amber-950/50 text-amber-300"
              : "border-slate-700 text-slate-400"
          }`}
        >
          ⚓ Installations {showInstallations ? "ON" : "OFF"}
        </button>
        {showInstallations && installationTypes.length > 0 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter installations by type"
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-slate-300"
          >
            <option value="all">All types ({installations.length})</option>
            {installationTypes.map((t) => {
              const stats = perTypeStats.get(t)!;
              return (
                <option key={t} value={t}>
                  {typeLabel(t)} · {stats.sites} sites · {stats.countries} countries
                </option>
              );
            })}
          </select>
        )}
        <span className="text-slate-500">
          Hover for intelligence · click to open profile · scroll to zoom · drag to pan
        </span>
        {transform.k > 1 && (
          <button
            type="button"
            onClick={() => setTransform({ k: 1, x: 0, y: 0 })}
            className="rounded border border-slate-700 px-2 py-1 text-slate-400 hover:text-slate-200"
          >
            Reset view
          </button>
        )}
      </div>

      <div className="relative overflow-hidden rounded border border-slate-800 bg-slate-950">
        <svg
          width="100%"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block select-none"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handlePan}
          onMouseUp={endDrag}
          onMouseLeave={() => {
            endDrag();
            setHover(null);
          }}
        >
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            <path
              d={graticulePath}
              fill="none"
              stroke="#1e293b"
              strokeWidth={0.4 / transform.k}
            />
            {rendered.map(({ jf, d }) => {
              const info = jf.alpha3 ? countryByIso.get(jf.alpha3) : undefined;
              const budget = info ? latestBudgetByCountry.get(info.id) : undefined;
              const inConflict =
                info && (conflictsByCountry.get(info.id)?.length ?? 0) > 0;
              const shade = budget?.amount
                ? 0.1 + 0.5 * Math.sqrt(budget.amount / maxBudget)
                : 0;
              const fill = inConflict
                ? "#7f1d1d"
                : budget?.amount
                  ? `rgba(56,189,248,${shade.toFixed(3)})`
                  : info
                    ? "rgba(56,189,248,0.22)"
                    : "rgba(30,41,59,0.6)";
              return (
                <path
                  key={String(jf.feature.id ?? d)}
                  d={d}
                  fill={fill}
                  stroke={info ? "#38bdf8" : "#334155"}
                  strokeWidth={(info ? 0.6 : 0.35) / transform.k}
                  className={info ? "cursor-pointer" : "cursor-default"}
                  onMouseMove={(e) => handleCountryMove(e, jf)}
                  onClick={() => handleCountryClick(jf)}
                  style={{ transition: "fill 150ms" }}
                />
              );
            })}

            {showInstallations && (
              <InstallationLayer
                installations={filteredInstallations}
                projection={projection}
                zoom={transform.k}
                onHover={(inst, x, y) => {
                  /* Synthesise an untracked hover so the shared panel shows
                   * the facility card via AtlasTooltip fallback + detail. */
                  setHover({
                    jf: {
                      feature: { properties: { name: inst.name } } as never,
                      alpha3: null,
                    },
                    x,
                    y,
                  });
                }}
                onLeave={() => setHover(null)}
                error={installationsError}
              />
            )}

            {showSatellites && (
              <SatelliteLayer
                satellites={satellites}
                error={satellitesError}
                projection={projection}
                zoom={transform.k}
              />
            )}
          </g>
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute z-20 w-64 rounded border border-slate-700 bg-slate-950/95 p-3 text-xs shadow-xl"
            style={{
              left: Math.min(hover.x + 12, WIDTH - 270),
              top: Math.min(hover.y + 12, HEIGHT - 200),
            }}
          >
            <AtlasTooltip info={hoverInfo} fallbackName={hoverName} />
          </div>
        )}

        <div className="absolute bottom-2 left-2 rounded border border-slate-800 bg-slate-950/80 p-2 text-[10px] text-slate-400">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: "rgba(56,189,248,0.5)" }}
            />
            <span>Tracked country · shade ∝ latest budget</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-red-900" />
            <span>Conflict involvement</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: "rgba(30,41,59,0.6)" }}
            />
            <span>Untracked land</span>
          </div>
          {showInstallations && installationTypes.length > 0 && (
            <div className="mt-2 border-t border-slate-800 pt-2">
              {installationTypes.map((t) => {
                const style =
                  INSTALLATION_TYPE_STYLE[t] ?? INSTALLATION_TYPE_STYLE.other;
                const stats = perTypeStats.get(t)!;
                return (
                  <div key={t} className="mt-1 flex items-center gap-2">
                    <span
                      className="inline-flex h-3 w-3 items-center justify-center rounded-full text-[8px]"
                      style={{ background: style.color, color: "#020617" }}
                    >
                      {style.glyph}
                    </span>
                    <span>
                      {typeLabel(t)} · {stats.sites} sites
                      · {stats.countries} countries
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <p className="text-[10px] leading-4 text-slate-600">
        Map data: Natural Earth (public domain) via world-atlas. Satellite
        positions are propagated with SGP4 from public CelesTrak elements
        (refreshed ≤6h); operator/role attribution is a curated approximation
        of publicly documented programmes. Installations are publicly
        documented sites with sources.
      </p>
    </div>
  );
}
