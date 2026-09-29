import { type NextRequest, NextResponse } from "next/server";
import { defenceStockSymbols, StockQuote } from "@/lib/stockSymbols";
import { rateLimit, requestKey } from "@/lib/security/rateLimit";

/*
 * Server-side proxy to the Finnhub stock API.
 *
 * Why Finnhub?
 *   • Free tier: 60 calls/min (vs Alpha Vantage's 5/min)
 *   • No batch endpoint — each symbol needs a separate call,
 *     but 24 symbols × 1 call/60s = 24 calls/min is well under 60.
 *
 * The route caches results in a module-level variable for 60 s.
 * In a multi-instance deployment each instance caches independently;
 * with the 60/min free tier that is well within limits.
 */
const CACHE_SECONDS = 60;

interface FinnhubQuote {
  c: number;  // Current price
  d: number;  // Change
  dp: number; // Percent change
  h: number;  // High price of the day
  l: number;  // Low price of the day
  o: number;  // Open price of the day
  pc: number; // Previous close price
  t: number;  // Unix timestamp (seconds)
}

/* In-memory cache keyed by symbol set — single shared result set. */
let cache: { data: StockQuote[]; timestamp: number } | null = null;

const DISCLAIMER =
  "Data provided by Finnhub. Free-tier quotes may be delayed. Not investment advice.";

/** Fetch a single quote from Finnhub; returns null on any error. */
async function fetchFinnhubQuote(
  symbol: string,
  apiKey: string,
): Promise<FinnhubQuote | null> {
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "DefenceIntel/1.0 (stock-ticker)" },
    });
    if (!res.ok) return null;
    const json: FinnhubQuote = await res.json();
    /* Finnhub returns all zeros for invalid/closed symbols. */
    if (json.c === 0 && json.d === 0 && json.pc === 0) return null;
    return json;
  } catch {
    return null;
  }
}

/**
 * Fetch quotes for all defence symbols in parallel (24 concurrent
 * requests — well within the 60 calls/min free tier limit).
 */
async function fetchAllQuotes(
  apiKey: string,
): Promise<StockQuote[]> {
  return Promise.all(
    defenceStockSymbols.map(async (sym) => {
      const q = await fetchFinnhubQuote(sym.symbol, apiKey);
      return {
        symbol: sym.symbol,
        name: sym.name,
        price: q?.c ?? null,
        change: q?.d ?? null,
        changePercent: q?.dp ?? null,
        previousClose: q?.pc ?? null,
        volume: null, // Finnhub /quote does not include volume
        marketState: q ? "NORMAL" : "UNKNOWN",
        exchange: sym.exchange,
        country: sym.country,
        sector: sym.sector,
        currency: sym.currency,
        companyId: sym.companyId,
        timestamp: q?.t ? q.t * 1000 : null,
      } as StockQuote;
    }),
  );
}

function fallbackData(): StockQuote[] {
  return defenceStockSymbols.map((sym) => ({
    symbol: sym.symbol,
    name: sym.name,
    price: null,
    change: null,
    changePercent: null,
    previousClose: null,
    volume: null,
    marketState: "UNKNOWN" as const,
    exchange: sym.exchange,
    country: sym.country,
    sector: sym.sector,
    currency: sym.currency,
    companyId: sym.companyId,
    timestamp: null,
  }));
}

/**
 * GET /api/stocks
 *
 * Returns:
 *   {
 *     data: StockQuote[],
 *     lastUpdated: number,   // unix-ms of the data
 *     cached: boolean,       // served from in-memory cache
 *     disclaimer: string,
 *     error?: string
 *   }
 */
export async function GET(request: NextRequest) {
  const limit = rateLimit(`stocks:${requestKey(request)}`, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  /* Serve from cache if still fresh */
  if (cache && Date.now() - cache.timestamp < CACHE_SECONDS * 1000) {
    return NextResponse.json({
      data: cache.data,
      lastUpdated: cache.timestamp,
      cached: true,
      disclaimer: DISCLAIMER,
    });
  }

  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    /* No API key — return static list with null prices. */
    const data = fallbackData();
    cache = { data, timestamp: Date.now() };
    return NextResponse.json({
      data,
      lastUpdated: cache.timestamp,
      cached: false,
      error: "FINNHUB_API_KEY is not set. Sign up at finnhub.io for a free key.",
      disclaimer: DISCLAIMER,
    });
  }

  try {
    const data = await fetchAllQuotes(apiKey);
    cache = { data, timestamp: Date.now() };

    return NextResponse.json({
      data,
      lastUpdated: cache.timestamp,
      cached: false,
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    console.error("[stocks] Finnhub fetch failed:", error);
    const data = fallbackData();
    cache = { data, timestamp: Date.now() };
    return NextResponse.json(
      {
        data,
        lastUpdated: cache.timestamp,
        cached: false,
        error: "Market data temporarily unavailable.",
        disclaimer: DISCLAIMER,
      },
      { status: 502 },
    );
  }
}