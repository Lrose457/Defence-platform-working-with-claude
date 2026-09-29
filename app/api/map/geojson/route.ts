import { NextResponse } from "next/server";
import { safeOutboundFetch } from "@/lib/security/ssrf";

const GEOJSON_URL = "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson";

export async function GET() {
  const response = await safeOutboundFetch(GEOJSON_URL, {
    headers: { Accept: "application/geo+json, application/json" },
    next: { revalidate: 86_400 },
  });

  if (!response.ok) return NextResponse.json({ error: "Map data unavailable." }, { status: 502 });
  return new NextResponse(await response.text(), {
    headers: { "Content-Type": "application/geo+json", "Cache-Control": "public, max-age=86400" },
  });
}
