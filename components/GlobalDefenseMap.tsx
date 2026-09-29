"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { geoEqualEarth, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { supabase } from "@/lib/supabase/supabase";
import {
  METRICS,
  TREND_BASELINE_YEAR,
  buildBins,
  binFor,
  cartogramScale,
  formatCurrency,
  formatCurrencyExact,
  formatPercent,
  formatPercentOfGdp,
  normaliseRegion,
  resolveBudgetForYear,
  resolveLatestBudget,
  type Bin,
  type Budget,
  type Conflict,
  type Country,
  type MetricId,
} from "@/lib/mapData";

const GEO_URL = "/api/map/geojson";

/** Countries with no budget row are outlined, never filled as zero. */
const NO_DATA_FILL = "#111c2e";
const NO_DATA_STROKE = "#1e293b";
const LAND_STROKE = "#0f172a";

/**
 * Equal-earth projection fitted to the 800x500 viewBox.
 *
 * Equal-earth is used rather than Mercator because Mercator inflates high
 * latitude landmasses, which is precisely the distortion this map exists to
 * correct: on Mercator, Greenland and Russia read as comparable to the United
 * States in defence spending, which they are not.
 */
const PROJECTION = geoEqualEarth().fitExtent(
  [
    [8, 8],
    [792, 492],
  ],
  { type: "Sphere" },
);
const PATH_GENERATOR = geoPath(PROJECTION);

/**
 * Project a lon/lat pair into viewBox coordinates, or null when the point is
 * outside the projection's clip extent (e.g. a country with no coordinates).
 */
function projectPoint(lon: number, lat: number): [number, number] | null {
  const projected = PROJECTION([lon, lat]);
  if (!projected) return null;
  const [x, y] = projected;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [x, y];
}

/**
 * Circle radius for a proportional-symbol layer.
 *
 * Radius scales with the *square root* of the value ratio so rendered AREA is
 * proportional to the value, matching the cartogram's convention. A linear
 * radius would visually exaggerate large countries; that is the most common
 * error in proportional-symbol maps.
 *
 * Returns null when there is no data, so unknown countries are simply not
 * drawn rather than appearing as a zero-size dot indistinguishable from a
 * genuinely tiny value.
 */
function circleRadius(
  value: number | null,
  maxValue: number,
  maxRadius = 34,
): number | null {
  if (value === null || !Number.isFinite(value) || value <= 0 || maxValue <= 0) {
    return null;
  }
  // Strict area-proportional: r = maxRadius * sqrt(value / maxValue).
  //
  // No additive minimum. An earlier version added a minRadius offset, which
  // made small countries render too large and broke the proportionality this
  // encoding claims: a 2x value ratio rendered as 1.77x area rather than 2x.
  // Verified area ratios are now 2.00 for every 2x step in value.
  return maxRadius * Math.sqrt(value / maxValue);
}


function pathFor(feature: Feature<Geometry>): string | null {
  return PATH_GENERATOR(feature) ?? null;
}

type Encoding = "choropleth" | "cartogram" | "proportional";


type Props = {
  /** Layer shown on first render. */
  initialMetric?: MetricId;
  /** Countries with data, keyed for the accessible fallback list. */
  initialCountries?: Country[];
  initialBudgets?: Budget[];
  initialConflicts?: Conflict[];
  /** Rendered when a layer has no rows yet, naming the missing dataset. */
  emptyHint?: Partial<Record<MetricId, string>>;
};

export default function GlobalDefenseMap({
  initialMetric = "spending",
  initialCountries,
  initialBudgets,
  initialConflicts,
  emptyHint,
}: Props) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const [countries, setCountries] = useState<Country[]>(initialCountries ?? []);
  const [budgets, setBudgets] = useState<Budget[]>(initialBudgets ?? []);
  const [conflicts, setConflicts] = useState<Conflict[]>(initialConflicts ?? []);
  const [metric, setMetric] = useState<MetricId>(initialMetric);
  const [encoding, setEncoding] = useState<Encoding>("choropleth");
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!initialCountries);
  const [error, setError] = useState<string | null>(null);

  const isConflictMetric = metric === "conflicts";

  useEffect(() => {
    if (initialCountries && initialCountries.length > 0) return;
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const geoResponse = await fetch(GEO_URL);
        if (!geoResponse.ok) {
          throw new Error(`Map geometry unavailable (HTTP ${geoResponse.status})`);
        }
        const [geo, countryResult, budgetResult] = await Promise.all([
          geoResponse.json() as Promise<FeatureCollection>,
          supabase
            .from("countries")
            .select("id,name,iso_code,region,latitude,longitude"),
          supabase
            .from("budgets")
            .select(
              "country_id,year,amount_usd,constant_amount_usd,percentage_gdp,percentage_government_spending,data_confidence",
            )
            .order("year", { ascending: false }),
        ]);

        if (cancelled) return;
        if (countryResult.error) throw countryResult.error;
        if (budgetResult.error) throw budgetResult.error;

        setGeoData(geo);
        setCountries((countryResult.data ?? []) as Country[]);
        setBudgets((budgetResult.data ?? []) as Budget[]);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Unable to load map data",
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // Only run on mount: metric changes must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialConflicts && initialConflicts.length > 0) return;
    if (!isConflictMetric || conflicts.length > 0) return;
    let cancelled = false;

    async function loadConflicts() {
      const { data, error: conflictError } = await supabase
        .from("conflicts")
        .select("id,name,region,status,start_date")
        .limit(500);
      if (cancelled || conflictError) return;
      setConflicts((data ?? []) as Conflict[]);
    }

    loadConflicts();
    return () => {
      cancelled = true;
    };
  }, [isConflictMetric, conflicts.length, initialConflicts]);

  /** Per-country max year, resolved independently for each country. */
  const latestByCountry = useMemo(
    () => resolveLatestBudget(budgets),
    [budgets],
  );
  const baselineByCountry = useMemo(
    () => resolveBudgetForYear(budgets, TREND_BASELINE_YEAR),
    [budgets],
  );

  const latestYear = useMemo(() => {
    if (budgets.length === 0) return null;
    return budgets.reduce((max, b) => (b.year > max ? b.year : max), budgets[0].year);
  }, [budgets]);

  /** Conflicts grouped by normalised region. */
  const conflictByRegion = useMemo(() => {
    const grouped = new Map<string, { count: number; active: number; names: string[] }>();
    for (const conflict of conflicts) {
      const region = normaliseRegion(conflict.region);
      if (!region) continue;
      const entry = grouped.get(region) ?? { count: 0, active: 0, names: [] };
      entry.count += 1;
      if (conflict.status === "Active") entry.active += 1;
      if (entry.names.length < 4) entry.names.push(conflict.name);
      grouped.set(region, entry);
    }
    return grouped;
  }, [conflicts]);

  /**
   * Resolve the plotted value for a country under the active metric.
   * Returns null when the source does not cover that country, which is
   * rendered as "no data" rather than as zero.
   */
  const valueFor = useCallback(
    (country: Country): number | null => {
      if (isConflictMetric) {
        const region = normaliseRegion(country.region);
        return region ? (conflictByRegion.get(region)?.count ?? 0) : null;
      }
      const budget = latestByCountry.get(country.id);
      if (!budget) return null;
      if (metric === "spending") return budget.amount_usd;
      if (metric === "burden") {
        return budget.percentage_gdp === null
          ? null
          : budget.percentage_gdp * 100;
      }
      const baseline = baselineByCountry.get(country.id);
      if (!baseline?.constant_amount_usd) return null;
      const now = budget.constant_amount_usd ?? budget.amount_usd;
      if (!now) return null;
      return ((now - baseline.constant_amount_usd) / baseline.constant_amount_usd) * 100;
    },
    [
      isConflictMetric,
      metric,
      latestByCountry,
      baselineByCountry,
      conflictByRegion,
    ],
  );

  const values = useMemo(() => {
    const collected: number[] = [];
    for (const country of countries) {
      const value = valueFor(country);
      if (value !== null && Number.isFinite(value)) collected.push(value);
    }
    return collected;
  }, [countries, valueFor]);

  const bins: Bin[] = useMemo(() => {
    const format =
      metric === "burden"
        ? (v: number) => `${v.toFixed(2)}%`
        : metric === "trend"
          ? (v: number) => formatPercent(v)
          : metric === "conflicts"
            ? (v: number) => `${Math.round(v)}`
            : (v: number) => formatCurrency(v);
    return buildBins(values, format);
  }, [values, metric]);

  const noDataCount = useMemo(
    () => countries.filter((country) => valueFor(country) === null).length,
    [countries, valueFor],
  );

  const maxValue = useMemo(
    () => (values.length > 0 ? Math.max(...values) : 0),
    [values],
  );

  const countriesByIso = useMemo(() => {
    const map = new Map<string, Country>();
    for (const country of countries) {
      if (country.iso_code) map.set(country.iso_code, country);
    }
    return map;
  }, [countries]);

  const activeMetric = METRICS.find((m) => m.id === metric) ?? METRICS[0];

  const isoForFeature = (feature: { properties?: unknown }): string => {
    const properties = feature.properties as Record<string, unknown> | null | undefined;
    return String(
      properties?.["ISO3166-1-Alpha-3"] ?? properties?.iso_a3 ?? "",
    );
  };

  /**
   * Cartogram transform.
   *
   * d3-geo 3.1.1 has no `geoCartogram` (it is a third-party module, not part of
   * d3), so the rescale is done by shrinking each country about its own
   * centroid. This is a compacting cartogram, not a topology-preserving
   * Dorling one: neighbouring countries no longer tile edge to edge. Area is
   * still proportional to value, which is the property the encoding exists to
   * communicate, and no extra dependency is introduced.
   */
  const cartogramTransform = useCallback(
    (country: Country) => {
      const scale = cartogramScale(valueFor(country), maxValue);
      if (scale === null || encoding !== "cartogram") return null;
      const cx = country.longitude ?? 0;
      const cy = country.latitude ?? 0;
      return `translate(${cx} ${cy}) scale(${scale.toFixed(3)}) translate(${-cx} ${-cy})`;
    },
    [encoding, valueFor, maxValue],
  );

  const fillFor = useCallback(
    (country: Country | undefined): string => {
      if (!country) return NO_DATA_FILL;
      const value = valueFor(country);
      if (value === null) return NO_DATA_FILL;
      // In proportional mode the fill is muted so the circles, not the
      // choropleth, carry the value encoding.
      if (encoding === "proportional") return "#16233a";
      return binFor(bins, value)?.color ?? NO_DATA_FILL;
    },
    [valueFor, bins, encoding],
  );

  /** Countries that have coordinates and a value, ready to draw as circles. */
  const circlePoints = useMemo(() => {
    if (encoding !== "proportional") return [];
    const points: { iso: string; country: Country; x: number; y: number; r: number; value: number }[] = [];
    for (const country of countries) {
      if (!country.iso_code) continue;
      if (country.latitude === null || country.longitude === null) continue;
      const value = valueFor(country);
      const radius = circleRadius(value, maxValue);
      if (value === null || radius === null) continue;
      const point = projectPoint(country.longitude, country.latitude);
      if (!point) continue;
      points.push({ iso: country.iso_code, country, x: point[0], y: point[1], r: radius, value });
    }
    // Draw larger circles first so small ones stay visible on top.
    return points.sort((a, b) => b.r - a.r);
  }, [encoding, countries, valueFor, maxValue]);

  const circleMaxLabel = useMemo(
    () => (maxValue > 0 ? activeMetric?.id === "burden" ? `${maxValue.toFixed(2)}%` : formatCurrency(maxValue) : "—"),
    [maxValue, activeMetric],
  );


  const describe = useCallback(
    (iso: string): { name: string; lines: string[] } | null => {
      const country = iso ? countriesByIso.get(iso) : undefined;
      if (!country) return null;
      const value = valueFor(country);
      const budget = latestByCountry.get(country.id);
      const lines: string[] = [];

      if (isConflictMetric) {
        const region = normaliseRegion(country.region);
        const entry = region ? conflictByRegion.get(region) : undefined;
        lines.push(`Region: ${region ?? "Unassigned"}`);
        lines.push(`Conflicts: ${entry?.count ?? 0} tracked`);
        if (entry?.active) lines.push(`Active: ${entry.active}`);
        if (entry?.names.length) lines.push(`Includes: ${entry.names.join("; ")}`);
      } else {
        lines.push(
          metric === "burden"
            ? `Defence burden: ${formatPercentOfGdp(budget?.percentage_gdp)} of GDP`
            : metric === "trend"
              ? `Change since ${TREND_BASELINE_YEAR}: ${formatPercent(value)}`
              : `Spending: ${formatCurrencyExact(budget?.amount_usd)}`,
        );
        if (metric !== "trend" && budget?.amount_usd) {
          lines.push(`Constant 2024 USD: ${formatCurrencyExact(budget.constant_amount_usd)}`);
        }
        if (budget) {
          lines.push(`Data year: ${budget.year}`);
          if (budget.data_confidence) lines.push(`Confidence: ${budget.data_confidence}`);
        } else {
          lines.push("Data year: no record");
        }
      }

      return { name: country.name, lines };
    },
    [countriesByIso, valueFor, latestByCountry, isConflictMetric, metric, conflictByRegion],
  );

  const tooltipCountry = hovered ?? selected;
  const tooltip = tooltipCountry ? describe(tooltipCountry) : null;
  const selectedCountry = selected ? countriesByIso.get(selected) : undefined;

  const ariaLabelFor = useCallback(
    (country: Country | undefined, value: number | null): string | undefined => {
      if (!country) return undefined;
      if (value === null) return `${country.name}: no data`;
      if (metric === "burden") {
        return `${country.name}: ${formatPercentOfGdp(
          latestByCountry.get(country.id)?.percentage_gdp,
        )} of GDP`;
      }
      if (metric === "trend") return `${country.name}: ${formatPercent(value)} since ${TREND_BASELINE_YEAR}`;
      if (metric === "conflicts") return `${country.name}: ${Math.round(value)} tracked conflicts`;
      return `${country.name}: ${formatCurrency(value)}`;
    },
    [metric, latestByCountry],
  );

  const ranked = useMemo(
    () =>
      countries
        .map((country) => ({ country, value: valueFor(country) }))
        .filter(
          (entry): entry is { country: Country; value: number } =>
            entry.value !== null,
        )
        .sort((a, b) => b.value - a.value),
    [countries, valueFor],
  );

  const emptyMessage = (() => {
    if (isLoading || error) return null;
    if (isConflictMetric && conflicts.length === 0) {
      return (
        emptyHint?.conflicts ??
        "No conflicts are tracked yet. Conflict records enter the platform through the ingestion review queue; until then this layer is empty by design, not by error."
      );
    }
    if (!isConflictMetric && countries.length === 0) {
      return "No country records are available to plot.";
    }
    return null;
  })();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Layer
            </h3>
            <div role="radiogroup" aria-label="Map layer" className="mt-2 grid gap-1">
              {METRICS.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-start gap-2 rounded border px-2 py-1.5 text-xs transition-colors ${
                    metric === option.id
                      ? "border-cyan-700 bg-cyan-950/40 text-cyan-200"
                      : "border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="map-metric"
                    value={option.id}
                    checked={metric === option.id}
                    onChange={() => setMetric(option.id)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium">{option.label}</span>
                    <span className="block text-[10px] text-slate-500">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {!isConflictMetric && (
            <fieldset className="border-t border-slate-800 pt-3">
              <legend className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Encoding
              </legend>
              <div className="mt-2 grid gap-1">
                {(
                  [
                    {
                      id: "choropleth" as Encoding,
                      label: "Choropleth",
                      hint: "Equal area, colour by value",
                    },
                    {
                      id: "cartogram" as Encoding,
                      label: "Cartogram",
                      hint: "Area scaled to value — shows concentration",
                    },
                    {
                      id: "proportional" as Encoding,
                      label: "Proportional circles",
                      hint: "Circle area scaled to value",
                    },
                  ]
                ).map((option) => (
                  <label
                    key={option.id}
                    className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-xs ${
                      encoding === option.id
                        ? "border-cyan-700 bg-cyan-950/40 text-cyan-200"
                        : "border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="map-encoding"
                      checked={encoding === option.id}
                      onChange={() => setEncoding(option.id)}
                    />
                    <span>
                      <span className="block font-medium">{option.label}</span>
                      <span className="block text-[10px] text-slate-500">
                        {option.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {bins.length > 0 && (
            <div className="border-t border-slate-800 pt-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {activeMetric.shortLabel} scale
              </h3>
              <ul className="mt-2 space-y-1">
                {bins.map((bin) => (
                  <li key={bin.index} className="flex items-center gap-2 text-[10px] font-mono">
                    <span
                      className="h-3 w-4 shrink-0 rounded-sm"
                      style={{ backgroundColor: bin.color }}
                      aria-hidden
                    />
                    <span className="text-slate-400">up to {bin.label}</span>
                  </li>
                ))}
                <li className="flex items-center gap-2 text-[10px] font-mono">
                  <span
                    className="h-3 w-4 shrink-0 rounded-sm border border-slate-700"
                    style={{ backgroundColor: NO_DATA_FILL }}
                    aria-hidden
                  />
                  <span className="text-slate-500">no data ({noDataCount} countries)</span>
                </li>
              </ul>
              <p className="mt-2 text-[10px] text-slate-500">
                Source: SIPRI Military Expenditure Database. Latest year in
                dataset: {latestYear ?? "—"}.
              </p>
            </div>
          )}

          {selectedCountry && (
            <div className="border-t border-slate-800 pt-3 text-xs">
              <p className="font-medium text-slate-200">{selectedCountry.name}</p>
              <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-slate-400">
                {selectedCountry && selected
                  ? describe(selected)?.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))
                  : null}
              </ul>
              <div className="mt-2 flex gap-3">
                <Link
                  href={`/countries/${selectedCountry.id}`}
                  className="text-cyan-400 hover:underline"
                >
                  Open profile →
                </Link>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ---------------- Map canvas ---------------- */}
        <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-2">
          {isLoading && (
            <div
              className="flex h-[520px] items-center justify-center text-xs font-mono text-slate-500"
              role="status"
            >
              Loading geometry and budget data…
            </div>
          )}

          {error && (
            <div className="rounded border border-red-900/60 bg-red-950/20 p-4 text-sm text-red-200">
              Map unavailable: {error}
            </div>
          )}

          {!isLoading && !error && geoData && (
            <>
              <svg
                viewBox="0 0 800 500"
                role="img"
                aria-label={`World map of ${activeMetric.label}`}
                className="h-auto w-full"
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSelected(null);
                }}
              >
                <rect width="800" height="500" fill="#0f172a" />
                {geoData.features.map((feature, index) => {
                  const iso = isoForFeature(feature);
                  const country = countriesByIso.get(iso);
                  const value = country ? valueFor(country) : null;
                  const transform = country ? cartogramTransform(country) : null;
                  const isActive = iso === tooltipCountry;
                  return (
                    <path
                      key={`${iso || "feature"}-${index}`}
                      d={pathFor(feature as Feature<Geometry>) ?? ""}
                      transform={transform ?? undefined}
                      fill={fillFor(country)}
                      stroke={value === null ? NO_DATA_STROKE : LAND_STROKE}
                      strokeWidth={isActive ? 1.5 : 0.4}
                      tabIndex={country ? 0 : -1}
                      role={country ? "button" : undefined}
                      aria-label={ariaLabelFor(country, value)}
                      onMouseEnter={() => setHovered(iso || null)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(iso || null)}
                      onBlur={() => setHovered(null)}
                      onClick={() => setSelected((prev) => (prev === iso ? null : iso))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelected((prev) => (prev === iso ? null : iso));
                        }
                      }}
                      style={{ cursor: country ? "pointer" : "default" }}
                    />
                  );
                })}

                {/* Proportional-symbol layer. Drawn after the country fills so
                    the circles sit on top, largest first so small ones stay
                    visible. Colour is the choropleth bin so a reader can
                    cross-reference magnitude with the legend. */}
                {circlePoints.map((point) => {
                  const bin = binFor(bins, point.value);
                  return (
                    <circle
                      key={`circle-${point.iso}`}
                      cx={point.x}
                      cy={point.y}
                      r={point.r}
                      fill={bin?.color ?? "#64748b"}
                      fillOpacity={0.75}
                      stroke={point.iso === tooltipCountry ? "#e2e8f0" : "#0f172a"}
                      strokeWidth={point.iso === tooltipCountry ? 2 : 0.75}
                      className="cursor-pointer"
                      onMouseEnter={() => setHovered(point.iso)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() =>
                        setSelected((prev) => (prev === point.iso ? null : point.iso))
                      }
                    >
                      <title>{ariaLabelFor(point.country, point.value)}</title>
                    </circle>
                  );
                })}
              </svg>

              {tooltip && (
                <div
                  className="pointer-events-none absolute left-3 top-3 max-w-xs rounded border border-slate-700 bg-slate-900/95 p-3 text-xs shadow-lg"
                  role="tooltip"
                >
                  <p className="font-medium text-white">{tooltip.name}</p>
                  <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-slate-300">
                    {tooltip.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}

              {encoding === "proportional" && circlePoints.length > 0 && (
                <p className="mt-2 px-1 text-[10px] text-slate-500">
                  Circle area is proportional to{" "}
                  {activeMetric.shortLabel.toLowerCase()} (doubling a value
                  doubles the area). Largest circle: {circleMaxLabel}.
                  Countries without data are not drawn, so a missing circle
                  means an unknown value rather than zero.
                </p>
              )}

              {encoding === "cartogram" && !isConflictMetric && (
                <p className="mt-2 px-1 text-[10px] text-slate-500">
                  Cartogram: each country is scaled about its centroid so area is
                  proportional to {activeMetric.shortLabel.toLowerCase()}.
                  Countries no longer tile edge to edge, and those without data
                  keep their true size.
                </p>
              )}
            </>
          )}

          {emptyMessage && (
            <p className="px-1 py-3 text-xs text-slate-400">{emptyMessage}</p>
          )}
        </div>
      </div>

      {/* Keyboard-navigable mirror of the map, so the same data is reachable
          without a pointer. */}
      {ranked.length > 0 && (
        <details className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-slate-400">
            Data table — top {Math.min(ranked.length, 20)} by{" "}
            {activeMetric.shortLabel.toLowerCase()}
          </summary>
          <table className="mt-3 w-full text-left text-xs">
            <caption className="sr-only">
              Countries ranked by {activeMetric.label}
            </caption>
            <thead className="text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="py-1 pr-2">Country</th>
                <th scope="col" className="py-1 pr-2">Value</th>
                <th scope="col" className="py-1">Year</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {ranked.slice(0, 20).map(({ country, value }) => {
                const budget = latestByCountry.get(country.id);
                return (
                  <tr key={country.id}>
                    <th scope="row" className="py-1 pr-2 font-normal text-slate-200">
                      <Link href={`/countries/${country.id}`} className="hover:text-cyan-400">
                        {country.name}
                      </Link>
                    </th>
                    <td className="py-1 pr-2 font-mono text-slate-300">
                      {metric === "burden"
                        ? formatPercentOfGdp(budget?.percentage_gdp)
                        : metric === "trend"
                          ? formatPercent(value)
                          : metric === "conflicts"
                            ? String(Math.round(value))
                            : formatCurrencyExact(value)}
                    </td>
                    <td className="py-1 font-mono text-slate-500">
                      {isConflictMetric ? "—" : (budget?.year ?? "—")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}



