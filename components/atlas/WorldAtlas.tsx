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
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { geoNaturalEarth1, geoPath, geoGraticule10, geoCentroid } from "d3-geo";
import type { GeoProjection } from "d3-geo";
const SatelliteLayer = dynamic(
  () => import("@/components/atlas/SatelliteLayer"),
  { ssr: false },
);
import InstallationLayer, {
  INSTALLATION_TYPE_STYLE,
} from "@/components/atlas/InstallationLayer";
import HybridLayer, {
  HybridIncidentCard,
  HYBRID_TARGET_STYLE,
} from "@/components/atlas/HybridLayer";
import AtlasTooltip, { type TrackedInfo } from "@/components/atlas/AtlasTooltip";
import {
  loadWorldFeatures,
  type AtlasCountry,
  type AtlasBudget,
  type AtlasConflict,
  type AtlasInstallation,
  type HybridWarfareIncident,
  type JoinedFeature,
} from "@/components/atlas/atlasData";

const WIDTH = 960;
const HEIGHT = 500;

const worldFeatures: JoinedFeature[] = loadWorldFeatures();

/** Hover target. Positions are container CSS pixels (the HTML overlay is
 * positioned in CSS px), so the panel tracks the cursor at any rendered
 * width and under zoom/pan — viewBox units made it drift whenever the
 * rendered width differed from WIDTH. */
type HoverState =
  | { kind: "country"; jf: JoinedFeature; x: number; y: number; cw: number; ch: number }
  | { kind: "installation"; installation: AtlasInstallation; x: number; y: number; cw: number; ch: number }
  | { kind: "incident"; incident: HybridWarfareIncident; x: number; y: number; cw: number; ch: number };

/** Approximate overlay card heights, used to keep the panel inside the box. */
const HOVER_CARD_H: Record<HoverState["kind"], number> = {
  country: 176,
  installation: 132,
  incident: 272,
};

export interface WorldAtlasProps {
  countries: AtlasCountry[];
  budgets: AtlasBudget[];
  conflicts: AtlasConflict[];
  installations: AtlasInstallation[];
  installationsError: string | null;
  incidents: HybridWarfareIncident[];
  incidentsError: string | null;
}

export default function WorldAtlas({
  countries,
  budgets,
  conflicts,
  installations,
  installationsError,
  incidents,
  incidentsError,
}: WorldAtlasProps) {
  const router = useRouter();

  /* Zoom / pan */
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const dragRef = useRef<{ px: number; py: number } | null>(null);
  const draggedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /* Hover + layers */
  const [hover, setHover] = useState<HoverState | null>(null);
  const [showSatellites, setShowSatellites] = useState(true);
  const [showInstallations, setShowInstallations] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showHybrid, setShowHybrid] = useState(true);
  const [hybridStatusFilter, setHybridStatusFilter] = useState<string>("all");

  /* ── Data joins (all derived from props — nothing hardcoded) ── */

  const countryByIso = useMemo(() => {
    const map = new Map<string, AtlasCountry>();
    for (const c of countries) {
      if (c.iso_code) map.set(c.iso_code.toUpperCase(), c);
    }
    return map;
  }, [countries]);

  /* Attacked-country centroids for hybrid incident placement, derived from
   * the vendored Natural Earth topology (the view's rows usually carry no
   * lat/lng — broadcaster feeds rarely geolocate — and the live countries
   * table has no centroid columns, so the map source of truth is here). */
  const centroidByIso = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number }>();
    for (const jf of worldFeatures) {
      if (!jf.alpha3 || map.has(jf.alpha3)) continue;
      const [lng, lat] = geoCentroid(jf.feature);
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        map.set(jf.alpha3, { lat, lng });
      }
    }
    return map;
  }, []);

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

  const hybridCounts = useMemo(
    () => ({
      all: incidents.length,
      verified: incidents.filter((i) => i.status === "verified").length,
      possible: incidents.filter((i) => i.status === "possible").length,
    }),
    [incidents],
  );

  const filteredIncidents = useMemo(
    () =>
      hybridStatusFilter === "all"
        ? incidents
        : incidents.filter((i) => i.status === hybridStatusFilter),
    [incidents, hybridStatusFilter],
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
    /* Container CSS pixels: the overlay is positioned in CSS px, so viewBox
     * units made the panel drift from the cursor whenever the rendered
     * width differed from WIDTH (and under zoom/pan). */
    setHover({
      kind: "country",
      jf,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      cw: rect.width,
      ch: rect.height,
    });
  };

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    setTransform((t) => ({
      ...t,
      k: Math.min(12, Math.max(1, t.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15))),
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
        <button
          type="button"
          onClick={() => setShowHybrid((v) => !v)}
          aria-pressed={showHybrid}
          className={`rounded border px-2 py-1 font-mono transition-colors ${
            showHybrid
              ? "border-purple-700 bg-purple-950/50 text-purple-300"
              : "border-slate-700 text-slate-400"
          }`}
        >
          ⚠ Hybrid {showHybrid ? "ON" : "OFF"}
        </button>
        {showHybrid && hybridCounts.all > 0 && (
          <select
            value={hybridStatusFilter}
            onChange={(e) => setHybridStatusFilter(e.target.value)}
            aria-label="Filter hybrid incidents by status"
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-slate-300"
          >
            <option value="all">All hybrid ({hybridCounts.all})</option>
            <option value="verified">Verified ({hybridCounts.verified})</option>
            <option value="possible">Possible ({hybridCounts.possible})</option>
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

      <div
        ref={containerRef}
        className="relative overflow-hidden rounded border border-slate-800 bg-slate-950"
      >
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
                  /* Facility card in the shared HTML overlay (container px). */
                  const rect = containerRef.current?.getBoundingClientRect();
                  setHover({
                    kind: "installation",
                    installation: inst,
                    x,
                    y,
                    cw: rect?.width ?? WIDTH,
                    ch: rect?.height ?? HEIGHT,
                  });
                }}
                onLeave={() => setHover(null)}
                error={installationsError}
              />
            )}

            {showHybrid && (
              <HybridLayer
                incidents={filteredIncidents}
                projection={projection}
                zoom={transform.k}
                centroidByIso={centroidByIso}
                onHover={(incident, x, y) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  setHover({
                    kind: "incident",
                    incident,
                    x,
                    y,
                    cw: rect?.width ?? WIDTH,
                    ch: rect?.height ?? HEIGHT,
                  });
                }}
                onLeave={() => setHover(null)}
                error={incidentsError}
              />
            )}

            {showSatellites && (
              <SatelliteLayer projection={projection} zoom={transform.k} />
            )}
          </g>
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute z-20 w-64 rounded border border-slate-700 bg-slate-950/95 p-3 text-xs shadow-xl"
            style={{
              left: Math.max(4, Math.min(hover.x + 12, hover.cw - 268)),
              top: Math.max(
                4,
                Math.min(hover.y + 12, hover.ch - HOVER_CARD_H[hover.kind]),
              ),
            }}
          >
            {hover.kind === "country" && (
              <AtlasTooltip
                info={track(hover.jf)}
                fallbackName={hover.jf.feature.properties?.name ?? null}
              />
            )}
            {hover.kind === "installation" && (
              <InstallationHoverCard installation={hover.installation} />
            )}
            {hover.kind === "incident" && (
              <HybridIncidentCard incident={hover.incident} />
            )}
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
          {showHybrid && hybridCounts.all > 0 && (
            <div className="mt-2 border-t border-slate-800 pt-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: "#a855f7" }}
                />
                <span>Verified hybrid incident (filled)</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full border-2"
                  style={{ borderColor: "#a855f7", background: "#020617" }}
                />
                <span>Possible — pending review (hollow)</span>
              </div>
              {(["military", "civilian", "dual", "unknown"] as const).map(
                (t) => {
                  const style = HYBRID_TARGET_STYLE[t];
                  return (
                    <div key={t} className="mt-1 flex items-center gap-2">
                      <span
                        className="inline-flex h-3 w-3 items-center justify-center rounded-full text-[8px]"
                        style={{ background: style.color, color: "#020617" }}
                      >
                        {style.glyph}
                      </span>
                      <span>{style.label}</span>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-[10px] leading-4 text-slate-600">
        Map data: Natural Earth (public domain) via world-atlas. Satellite
        positions are propagated with SGP4 from public CelesTrak elements
        (refreshed ≤6h); operator/role attribution is a curated approximation
        of publicly documented programmes. Installations are publicly
        documented sites with sources. Hybrid-warfare incidents are
        auto-classified candidates from European public-broadcaster feeds —
        see the{" "}
        <Link
          href="/hybrid-warfare"
          className="text-blue-500 hover:text-blue-400"
        >
          hybrid warfare tracker
        </Link>{" "}
        for the reviewed longitudinal record.
      </p>
    </div>
  );
}

/** Compact facility panel for the shared HTML overlay (hover). */
function InstallationHoverCard({
  installation,
}: {
  installation: AtlasInstallation;
}) {
  const style =
    INSTALLATION_TYPE_STYLE[installation.type] ??
    INSTALLATION_TYPE_STYLE.other;
  return (
    <div>
      <p className="font-medium text-slate-100">{installation.name}</p>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">
        {style.label} · {installation.status ?? "status n/a"}
      </p>
      <p className="mt-1 text-slate-400">
        {installation.country_name ?? `Country ${installation.country_id}`}
      </p>
      {installation.notes && (
        <p className="mt-1 text-slate-400 line-clamp-3">{installation.notes}</p>
      )}
      <p className="mt-2 text-[10px] text-slate-500">
        Click the marker for the full record and source link.
      </p>
    </div>
  );
}
