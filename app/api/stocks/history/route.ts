import { type NextRequest, NextResponse } from "next/server";
import { rateLimit, requestKey } from "@/lib/security/rateLimit";

/*
 * GET /api/stocks/history?symbol=BA.L
 *
 * Server-side proxy to the Finnhub daily candle endpoint, mirroring the
 * pattern in app/api/stocks/route.ts: in-memory cache, rate limit, and a
 * graceful empty payload when FINNHUB_API_KEY is missing.
 *
 * Finnhub free tier: 60 calls/min. One call per requested symbol per
 * CACHE_SECONDS window is far below that.
 */
const CACHE_SECONDS = 300;

const RESOLUTION = "D";
const CANDLE_COUNT = 180; // ~6 months of trading days

interface HistoryResponse {
  symbol: string;
  /** ms timestamps for each candle. */
  timestamps: number[];
  /** Close price per candle, aligned with timestamps. */
  closes: number[];
  /** ISO currency code for the exchange (e.g. "USD", "GBP"). */
  currency: string;
  lastUpdated: number;
  cached: boolean;
  error?: string;
}

const DISCLAIMER =
  "Data provided by Finnhub. Free-tier candles may be delayed. Not investment advice.";

/* Cache keyed by symbol — one entry per symbol, single shared result set.
 * Bounded so requests for arbitrary symbols cannot grow memory forever. */
const MAX_CACHE_ENTRIES = 200;
const cache = new Map<string, { data: HistoryResponse; timestamp: number }>();

function emptyResponse(symbol: string, currency: string, error: string): HistoryResponse {
  return {
    symbol,
    timestamps: [],
    closes: [],
    currency,
    lastUpdated: Date.now(),
    cached: false,
    error,
  };
}

/**
 * GET handler. Returns `{ symbol, timestamps[], closes[], currency, ... }`.
 * With no FINNHUB_API_KEY (or an unsupported symbol) it returns an empty
 * series with an explanatory `error` field rather than a failure status.
 */
export async function GET(request: NextRequest) {
  const limit = rateLimit(`stocks-history:${requestKey(request)}`, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const symbol = request.nextUrl.searchParams.get("symbol")?.trim();
  if (!symbol) {
    return NextResponse.json(
      { error: "Missing required query parameter: symbol." },
      { status: 400 },
    );
  }

  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_SECONDS * 1000) {
    return NextResponse.json({ ...cached.data, cached: true, disclaimer: DISCLAIMER });
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    const data = emptyResponse(
      symbol,
      "",
      "FINNHUB_API_KEY is not set. Sign up at finnhub.io for a free key.",
    );
    cache.set(symbol, { data, timestamp: Date.now() });
    return NextResponse.json({ ...data, disclaimer: DISCLAIMER });
  }

  const to = Math.floor(Date.now() / 1000);
  const from = to - CANDLE_COUNT * 2 * 24 * 60 * 60; // calendar days; trading days are sparser

  try {
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${RESOLUTION}&from=${from}&to=${to}&token=${apiKey}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "DefenceIntel/1.0 (stock-history)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: {
      s: string;
      t?: number[];
      c?: number[];
      curr?: string;
    } = await res.json();

    /* Finnhub: s === "ok" with arrays, "no_data" for unsupported symbols
     * (most non-US tickers are premium on the free tier). */
    if (json.s !== "ok" || !json.t || !json.c) {
      const data = emptyResponse(
        symbol,
        json.curr ?? "",
        "No candle data available for this symbol on the Finnhub free tier.",
      );
      cache.set(symbol, { data, timestamp: Date.now() });
      return NextResponse.json({ ...data, disclaimer: DISCLAIMER });
    }

    const data: HistoryResponse = {
      symbol,
      timestamps: json.t.map((t) => t * 1000),
      closes: json.c,
      currency: json.curr ?? "",
      lastUpdated: Date.now(),
      cached: false,
    };
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(symbol, { data, timestamp: Date.now() });
    return NextResponse.json({ ...data, disclaimer: DISCLAIMER });
  } catch (error) {
    console.error("[stocks/history] Finnhub fetch failed:", error);
    const data = emptyResponse(symbol, "", "Market data temporarily unavailable.");
    cache.set(symbol, { data, timestamp: Date.now() });
    return NextResponse.json(
      { ...data, disclaimer: DISCLAIMER },
      { status: 502 },
    );
  }
}
