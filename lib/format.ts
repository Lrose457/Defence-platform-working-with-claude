/**
 * Shared formatting helpers.
 *
 * All dates are formatted in UTC to keep server-rendered output stable
 * (hydration-safe) and consistent across the site. Currency uses
 * Intl.NumberFormat with a fixed locale so server and client agree.
 */

const MONEY_FORMATTER = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const MONEY_FORMATTER_CENTS = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

/** Compact USD display: $1.2bn / $345m / $12,000 / "Not disclosed". */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "Not disclosed";
  }

  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}bn`;
  if (abs >= 1_000_000) return `$${Math.round(value / 1_000_000)}m`;
  if (abs >= 1_000) return MONEY_FORMATTER.format(value);
  return MONEY_FORMATTER_CENTS.format(value);
}

/** Full USD display with grouping, for tables. */
export function formatUsdFull(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "Not disclosed";
  }
  return MONEY_FORMATTER.format(value);
}

function utcDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ISO date (YYYY-MM-DD) in UTC; "—" when missing/invalid. */
export function formatDate(value: string | number | Date | null | undefined): string {
  const d = utcDate(value);
  if (!d) return value ? String(value) : "—";
  return d.toISOString().slice(0, 10);
}

/** Human date (12 Mar 2025) in UTC; "—" when missing/invalid. */
export function formatDateHuman(value: string | number | Date | null | undefined): string {
  const d = utcDate(value);
  if (!d) return value ? String(value) : "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Title-cases snake_case enum-ish values; "—" when missing. */
export function formatLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Formats a large number with grouping; "—" when missing. */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-GB");
}

/**
 * Converts a snake_case enum to a URL-friendly slug that survives
 * round-trips through route params and query strings.
 */
export function slugify(value: string): string {
  return value.toLowerCase().replaceAll("_", "-");
}
