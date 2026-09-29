/**
 * Shared in-memory TLE cache for the satellite API routes.
 *
 * Lives in its own module (not route.ts) so both /api/satellites and
 * /api/satellites/status read the same module-scope state without one
 * route importing the other's handler machinery.
 */

export interface TleRecord {
  name: string;
  line1: string;
  line2: string;
  group: string;
  country: string;
  iso3: string;
  role: string;
}

interface Cache {
  data: TleRecord[];
  timestamp: number;
}

let cache: Cache | null = null;

export function getCache(): Cache | null {
  return cache;
}

export function setCache(data: TleRecord[]): Cache {
  cache = { data, timestamp: Date.now() };
  return cache;
}

export function getCacheMeta(): {
  cached: boolean;
  timestamp: number | null;
  count: number;
} {
  return {
    cached: cache != null,
    timestamp: cache?.timestamp ?? null,
    count: cache?.data.length ?? 0,
  };
}

/** Age of a cache timestamp in hours, rounded to 0.1 (null if unknown).
 *  Kept out of component bodies — react-hooks/purity forbids Date.now()
 *  during render, even in server components. */
export function ageHoursSince(timestamp: number | null | undefined): number | null {
  if (timestamp == null) return null;
  return Math.round(((Date.now() - timestamp) / 3_600_000) * 10) / 10;
}
