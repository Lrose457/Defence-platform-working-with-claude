/**
 * Shared data model for the unified global defence map.
 *
 * Two correctness rules are enforced here rather than in the component,
 * because both were live bugs in the previous map implementations:
 *
 * 1. **Per-country max year.** Budget coverage is not aligned. Resolving "the
 *    latest budget" by scanning a globally year-sorted array returns whichever
 *    row appears first, not that country's newest row. `resolveLatestBudget`
 *    groups by country and takes the maximum year per country.
 *
 * 2. **`percentage_gdp` is a decimal fraction.** SIPRI stores 0.0253 for 2.53%.
 *    Rendering the raw value understates the burden by 100x, so the formatter
 *    multiplies by 100 and is the only sanctioned way to display it.
 */

export type Country = {
  id: number;
  name: string;
  iso_code: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type Budget = {
  country_id: number;
  year: number;
  amount_usd: number | null;
  constant_amount_usd: number | null;
  percentage_gdp: number | null;
  percentage_government_spending: number | null;
  data_confidence: string | null;
};

export type Conflict = {
  id: number;
  name: string;
  region: string | null;
  status: string | null;
  start_date: string | null;
  intensity_level: number | null;
  incident_count: number | null;
};

export type MetricId = "spending" | "burden" | "trend" | "conflicts";

export type Metric = {
  id: MetricId;
  label: string;
  shortLabel: string;
  units: string;
  description: string;
  /** For conflicts, higher means more severe. For budgets, higher means more. */
  direction: "value";
};

export const METRICS: Metric[] = [
  {
    id: "spending",
    label: "Defence spending (current USD)",
    shortLabel: "Absolute",
    units: "USD",
    description:
      "Annual military expenditure in current US dollars. Shows who spends most in absolute terms.",
    direction: "value",
  },
  {
    id: "burden",
    label: "Defence burden (% of GDP)",
    shortLabel: "% of GDP",
    units: "% of GDP",
    description:
      "Military expenditure as a share of gross domestic product. Exposes commitment that absolute totals hide.",
    direction: "value",
  },
  {
    id: "trend",
    label: "Change since 2015 (constant 2024 USD)",
    shortLabel: "Change",
    units: "% change",
    description:
      "Percentage change in inflation-adjusted spending since 2015. Distinguishes sustained build-ups from static posture.",
    direction: "value",
  },
  {
    id: "conflicts",
    label: "Tracked conflicts",
    shortLabel: "Conflicts",
    units: "conflicts",
    description:
      "Active conflict records reviewed into the platform, grouped by region.",
    direction: "value",
  },
];

/** Resolve each country's most recent budget year independently. */
export function resolveLatestBudget(
  budgets: Budget[],
): Map<number, Budget> {
  const latest = new Map<number, Budget>();
  for (const budget of budgets) {
    const existing = latest.get(budget.country_id);
    if (!existing || budget.year > existing.year) {
      latest.set(budget.country_id, budget);
    }
  }
  return latest;
}

/** Resolve a specific year per country, used for the trend baseline. */
export function resolveBudgetForYear(
  budgets: Budget[],
  year: number,
): Map<number, Budget> {
  const byCountry = new Map<number, Budget>();
  for (const budget of budgets) {
    if (budget.year !== year) continue;
    const existing = byCountry.get(budget.country_id);
    if (!existing || budget.year > existing.year) {
      byCountry.set(budget.country_id, budget);
    }
  }
  return byCountry;
}

export const TREND_BASELINE_YEAR = 2015;

/**
 * Region name normalisation.
 *
 * Conflicts arrive with free-text regions from several pipelines (HIIK uses
 * "WEST ASIA, NORTH AFRICA, AND AFGHANISTAN"; ACLED uses "Middle East";
 * analyst notes use "MENA"). The map needs one shared vocabulary so a conflict
 * resolves to the same country geometry as a budget figure, otherwise the two
 * layers disagree about where the same place is.
 */
export const REGION_ALIASES: Record<string, string> = {
  "west asia, north africa, and afghanistan": "West Asia & North Africa",
  "west asia, north africa & afghanistan": "West Asia & North Africa",
  "middle east": "West Asia & North Africa",
  mena: "West Asia & North Africa",
  "sub-saharan africa": "Sub-Saharan Africa",
  "sub saharan africa": "Sub-Saharan Africa",
  sahel: "Sub-Saharan Africa",
  horn: "Sub-Saharan Africa",
  "eastern europe": "Europe",
  "western europe": "Europe",
  "south east asia": "Asia & Oceania",
  southeast_asia: "Asia & Oceania",
  "south asia": "Asia & Oceania",
  "east asia": "Asia & Oceania",
  "central asia": "Asia & Oceania",
  asia: "Asia & Oceania",
  "the americas": "Americas",
  americas: "Americas",
  "latin america": "Americas",
  "north america": "Americas",
  "south america": "Americas",
};

export function normaliseRegion(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  return REGION_ALIASES[key] ?? value.trim();
}

/** Approximate centroid per normalised region, for placing conflict symbols. */
export const REGION_CENTROIDS: Record<string, [number, number]> = {
  "West Asia & North Africa": [45, 27],
  "Sub-Saharan Africa": [20, 4],
  Europe: [15, 50],
  "Asia & Oceania": [115, 20],
  Americas: [-85, 5],
  Oceania: [140, -25],
};

export function regionCoordinates(
  region: string | null | undefined,
): [number, number] | null {
  const normalised = normaliseRegion(region);
  if (!normalised) return null;
  return REGION_CENTROIDS[normalised] ?? null;
}

/** Compact currency for axis/legend labels: $1.4T, $47.6B, $812M. */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

/** Full precision currency for tooltips, where a reader may cite the figure. */
export function formatCurrencyExact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/**
 * Format a SIPRI `percentage_gdp` value. Stored as a decimal fraction
 * (0.0253 == 2.53%), so this multiplies by 100.
 */
export function formatPercentOfGdp(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export type Bin = {
  index: number;
  min: number;
  max: number;
  label: string;
  color: string;
  test: (value: number) => boolean;
};

/**
 * Sequential scale for magnitude, stepped from deep blue to red against the
 * #0f172a map background.
 */
const SCALE_COLORS = [
  "#1e3a8a",
  "#1d4ed8",
  "#0891b2",
  "#65a30d",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
];

/**
 * Build quantile bins so the edges are derived from the data rather than
 * hardcoded. Hardcoded thresholds break silently as coverage changes, and make
 * a no-data country indistinguishable from a low-value one.
 */
export function buildBins(
  values: number[],
  format: (value: number) => string,
  colorCount = SCALE_COLORS.length,
): Bin[] {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const bins: Bin[] = [];
  for (let i = 0; i < colorCount; i += 1) {
    const loIndex = Math.floor((i / colorCount) * sorted.length);
    const hiIndex = Math.ceil(((i + 1) / colorCount) * sorted.length) - 1;
    const min = sorted[Math.min(loIndex, sorted.length - 1)];
    const max = sorted[Math.min(Math.max(hiIndex, 0), sorted.length - 1)];
    const isLast = i === colorCount - 1;
    bins.push({
      index: i,
      min,
      max,
      label: format(max),
      color: SCALE_COLORS[i],
      test: (value: number) => (isLast ? value >= min : value >= min && value <= max),
    });
  }
  return bins;
}

export function binFor(bins: Bin[], value: number): Bin | null {
  return bins.find((bin) => bin.test(value)) ?? null;
}

/**
 * Cartogram scale factor for a country.
 *
 * Area must be proportional to value, so a linear factor is wrong; it has to be
 * the square root of the value ratio. Returns null when there is no data, so
 * those countries are drawn as outlines rather than collapsed to zero area,
 * which would render them invisible and look like missing geometry.
 */
export function cartogramScale(
  value: number | null | undefined,
  maxValue: number,
  minScale = 0.15,
): number | null {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value) ||
    value <= 0 ||
    maxValue <= 0
  ) {
    return null;
  }
  return Math.max(minScale, Math.sqrt(value / maxValue));
}


