import { type NextRequest, NextResponse } from "next/server";
import { rateLimit, requestKey } from "@/lib/security/rateLimit";
import { SATELLITE_GROUPS, attribute } from "@/lib/atlas/satelliteCatalog";

interface TleRecord {
  name: string;
  line1: string;
  line2: string;
  group: string;
  country: string;
  iso3: string;
  role: string;
}

function enrich(r: Omit<TleRecord, "country" | "iso3" | "role">): TleRecord {
  const a = attribute(r.name);
  return {
    ...r,
    country: a?.country ?? "Unattributed",
    iso3: a?.iso3 ?? "",
    role: a?.role ?? "Civil / other",
  };
}

/*
 * GET /api/satellites
 *
 * Server-side proxy to CelesTrak's GP API (TLE format) for the curated
 * military-relevant groups in lib/atlas/satelliteCatalog.ts. Cached in
 * module memory for 6 hours — orbital elements change slowly and CelesTrak
 * asks consumers to rate-limit. On upstream failure the last successful
 * copy is served stale; with no copy, an empty payload with an error is
 * returned so the atlas can degrade gracefully.
 */
const CACHE_MS = 6 * 60 * 60 * 1000;



let cache: { data: TleRecord[]; timestamp: number } | null = null;

async function fetchGroup(group: string): Promise<TleRecord[]> {
  const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=tle`;
  const res = await fetch(url, {
    headers: { "User-Agent": "DefenceIntel/1.0 (atlas-satellite-layer)" },
  });
  if (!res.ok) throw new Error(`CelesTrak HTTP ${res.status}`);
  const text = await res.text();
  /* CelesTrak answers some (empty or premium) groups with a short HTML/
   * plain-text notice rather than TLEs — treat those as legitimately empty. */
  if (text.trim().length < 100 || text.includes("<html")) {
    return [];
  }
  const records: TleRecord[] = [];
  const lines = text.split("\n").map((l) => l.trimEnd());
  for (let i = 0; i + 2 < lines.length; i++) {
    const name = lines[i].trim();
    if (!name) continue;
    if (lines[i + 1].startsWith("1 ") && lines[i + 2].startsWith("2 ")) {
      records.push(enrich({ name, line1: lines[i + 1], line2: lines[i + 2], group }));
      i += 2;
    }
  }
  return records;
}

export async function GET(request: NextRequest) {
  const limit = rateLimit(`satellites:${requestKey(request)}`, 30);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  if (cache && Date.now() - cache.timestamp < CACHE_MS) {
    return NextResponse.json({ ...cache, cached: true });
  }

  try {
    const groups = await Promise.all(SATELLITE_GROUPS.map(fetchGroup));
    /* Dedupe by line1 (NORAD id embedded there) — objects can appear in
     * several groups; keep the first occurrence. */
    const seen = new Set<string>();
    const data = groups.flat().filter((r) => {
      if (seen.has(r.line1)) return false;
      seen.add(r.line1);
      return true;
    });
    if (data.length === 0) {
      throw new Error("CelesTrak returned no TLE data for any group");
    }
    cache = { data, timestamp: Date.now() };
    return NextResponse.json({ ...cache, cached: false });
  } catch (error) {
    if (cache) {
      return NextResponse.json({ ...cache, cached: true, stale: true });
    }
    console.error("[satellites] CelesTrak fetch failed:", error);
    return NextResponse.json(
      {
        data: [],
        timestamp: Date.now(),
        error: "Satellite elements are unavailable right now.",
      },
      { status: 502 },
    );
  }
}
