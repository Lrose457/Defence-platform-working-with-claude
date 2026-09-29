import { headers } from "next/headers";
import StockTicker from "@/components/StockTicker";
import StockTable from "@/components/StockTable";
import { defenceStockSymbols, StockQuote } from "@/lib/stockSymbols";

interface StocksApiResponse {
  data: StockQuote[];
  lastUpdated: number;
  cached: boolean;
  error?: string;
  disclaimer?: string;
}

/** Build an absolute base URL for server-side internal fetches. */
async function getBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  // Running in a Server Component — derive origin from request headers.
  const headersList = await headers();
  const host =
    headersList.get("host") ||
    headersList.get("x-forwarded-host") ||
    "localhost:3000";
  const proto =
    headersList.get("x-forwarded-proto") ||
    (process.env.NODE_ENV === "development" ? "http" : "https");
  return `${proto}://${host}`;
}

/** Server-side fetch — called once at build/request time. */
async function fetchStockQuotes(): Promise<StocksApiResponse> {
  try {
    const base = await getBaseUrl();
    const res = await fetch(`${base}/api/stocks`, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (error) {
    console.error("[stocks:server] fetch failed:", error);
    return {
      data: defenceStockSymbols.map((s) => ({
        symbol: s.symbol,
        name: s.name,
        price: null,
        change: null,
        changePercent: null,
        previousClose: null,
        volume: null,
        marketState: "UNKNOWN" as const,
        exchange: s.exchange,
        country: s.country,
        sector: s.sector,
        currency: s.currency,
        companyId: s.companyId,
        timestamp: null,
      })),
      lastUpdated: 0,
      cached: false,
      error: "Unable to load market data.",
    };
  }
}

/* ── Page ────────────────────────────────────────────── */

export const revalidate = 60; // Next.js ISR: refresh page data every 60 s

export const metadata = {
  title: "Market Ticker — Defence Intelligence Platform",
  description: "Live stock quotes for defence contractors and primes.",
};

export default async function StocksPage() {
  const result = await fetchStockQuotes();
  const { data, lastUpdated, error, disclaimer } = result;

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">
          Defence Market Ticker
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Live quotes for <strong>{data.length}</strong> publicly-traded
          defence companies across {new Set(data.map((d) => d.country)).size} markets.
        </p>
      </div>

      {/* Horizontal marquee ticker */}
      <div className="mb-8">
        <StockTicker refreshInterval={60_000} />
      </div>

      {/* Detailed sortable table */}
      <section>
        <StockTable
          quotes={data}
          lastUpdated={lastUpdated}
          error={error}
        />
      </section>

      {/* Disclaimer */}
      <div className="mt-8 pt-4 border-t border-slate-800">
        <p className="text-[10px] uppercase tracking-wider text-slate-600">
          {disclaimer || "Data is delayed (15–20 min) and provided for informational purposes only. Not investment advice."}
        </p>
      </div>
    </div>
  );
}
