import { NextResponse } from "next/server";

/**
 * GET /api/satellites/status
 *
 * Tiny health endpoint for the TLE-refresh pipeline. The hourly
 * com.lrose.dip-tle-refresh LaunchAgent hits /api/satellites?refresh=1 to
 * pull fresh CelesTrak elements; this endpoint reports the age of that
 * cache so dashboards (and operators) can tell at a glance whether the
 * refresh loop is alive.
 *
 * Unauthenticated and cheap: it exposes only a timestamp and counts,
 * never element data.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  // The cache lives in the sibling route's module scope; import it lazily
  // via a shared module to avoid duplicating state.
  const { getCacheMeta } = await import("@/lib/atlas/tleCache");
  const meta = getCacheMeta();

  return NextResponse.json({
    ...meta,
    ageHours:
      meta.timestamp != null
        ? Math.round(((Date.now() - meta.timestamp) / 3_600_000) * 10) / 10
        : null,
  });
}
