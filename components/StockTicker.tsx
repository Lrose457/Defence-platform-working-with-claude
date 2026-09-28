"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { StockQuote, defenceStockSymbols } from "@/lib/stockSymbols";

export interface StockTickerProps {
  /** Maximum number of ticker items to display. */
  limit?: number;
  /** Compact mode (smaller padding/font) for tight spaces. */
  compact?: boolean;
  /** Auto-refresh interval in milliseconds. */
  refreshInterval?: number;
  /** Additional CSS classes for the outer container. */
  className?: string;
  /** Restrict the ticker to these Yahoo-style symbols (order preserved). */
  symbols?: string[];
  /** Called when a ticker item is clicked; takes precedence over deep-links. */
  onSymbolSelect?: (symbol: string) => void;
}

const DEFAULT_REFRESH_MS = 60_000;

/* ── Number / percent formatters ─────────────────────────── */

const priceFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const largeFmt = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function formatPrice(value: number | null): string {
  if (value === null) return "—";
  if (Math.abs(value) >= 1_000) return `$${largeFmt.format(value)}`;
  return `$${priceFmt.format(value)}`;
}

function formatChangePct(value: number | null): string {
  if (value === null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** Returns true if the html element has `data-reducedMotion="true"`. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const check = () => {
      const attr = document.documentElement.dataset.reducedMotion;
      if (attr === "true") {
        setReduced(true);
        return;
      }
      setReduced(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      );
    };
    check();
  }, []);

  return reduced;
}

/** Renders a single ticker item in the marquee. */
function TickerItem({
  quote,
  compact,
  onSymbolSelect,
}: {
  quote: StockQuote;
  compact: boolean;
  onSymbolSelect?: (symbol: string) => void;
}) {
  const isPositive =
    quote.changePercent !== null ? quote.changePercent >= 0 : false;

  const textCls = !quote.price
    ? "text-slate-600"
    : isPositive
      ? "text-green-400"
      : "text-red-400";

  const arrow = isPositive ? "▲" : "▼";

  const content = (
    <>
      <span className="font-mono font-bold text-slate-300">
        {quote.symbol}
      </span>
      {quote.price !== null && (
        <>
          <span className="text-slate-600">
            {compact ? " " : " | "}
          </span>
          <span className={`font-mono ${textCls}`}>
            {formatPrice(quote.price)}
          </span>
          <span className={`font-mono ${compact ? "ml-1" : "ml-2"} ${textCls}`}>
            {arrow} {formatChangePct(quote.changePercent)}
          </span>
        </>
      )}
      {quote.price === null && (
        <span className="font-mono text-slate-600 ml-1">—</span>
      )}
    </>
  );

  /* Selecting a symbol for the chart takes precedence over deep-links. */
  if (onSymbolSelect) {
    return (
      <button
        type="button"
        onClick={() => onSymbolSelect(quote.symbol)}
        title={`Show price history for ${quote.name}`}
        className={`
          inline-flex items-center ${compact ? "px-2 py-0.5" : "px-3 py-1"}
          rounded whitespace-nowrap text-xs text-left
          hover:bg-slate-800/50 transition-colors mx-2 cursor-pointer
          ${compact ? "" : "border border-slate-800"}
        `}
      >
        {content}
      </button>
    );
  }

  /* Deep-link to /companies/{id} when we have a matching companyId. */
  if (quote.companyId) {
    return (
      <Link
        href={`/companies/${quote.companyId}`}
        className={`
          inline-flex items-center ${compact ? "px-2 py-0.5" : "px-3 py-1"}
          rounded whitespace-nowrap text-xs
          hover:bg-slate-800/50 transition-colors mx-2
          ${compact ? "" : "border border-slate-800"}
        `}
      >
        {content}
      </Link>
    );
  }

  return (
    <span
      className={`
        inline-flex items-center ${compact ? "px-2 py-0.5" : "px-3 py-1"}
        whitespace-nowrap text-xs mx-2
      `}
    >
      {content}
    </span>
  );
}

/* ── Main ticker component ──────────────────────────────── */

export default function StockTicker({
  limit,
  compact = false,
  refreshInterval = DEFAULT_REFRESH_MS,
  className = "",
  symbols,
  onSymbolSelect,
}: StockTickerProps) {
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stocks", {
        cache: "no-store",
      });
      const json = await res.json();
      setQuotes(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      /* Show static fallback data with null prices */
      setQuotes(
        defenceStockSymbols.map((s) => ({
          symbol: s.symbol,
          name: s.name,
          price: null,
          change: null,
          changePercent: null,
          previousClose: null,
          volume: null,
          marketState: "UNKNOWN",
          exchange: s.exchange,
          country: s.country,
          sector: s.sector,
          currency: s.currency,
          companyId: s.companyId,
          timestamp: null,
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching pattern
    void fetchData();
    const id = setInterval(fetchData, refreshInterval);
    return () => clearInterval(id);
  }, [refreshInterval]);

  const filtered = symbols
    ? quotes.filter((q) => symbols.includes(q.symbol))
    : quotes;

  const displayQuotes = limit ? filtered.slice(0, limit) : filtered;

  if (loading && quotes.length === 0) {
    return (
      <div
        className={`
          flex items-center ${compact ? "text-xs" : "text-sm"}
          text-slate-500 ${className}
        `}
      >
        <span className="animate-pulse">Loading market data…</span>
      </div>
    );
  }

  /* ---- Reduced motion: static horizontal scroll ---- */
  if (reducedMotion) {
    return (
      <div
        className={`
          overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700
          ${compact ? "py-1" : "py-2"} ${className}
        `}
      >
        <div className="flex items-center gap-3 px-3">
          {displayQuotes.map((q) => (
            <TickerItem
              key={q.symbol}
              quote={q}
              compact={compact}
              onSymbolSelect={onSymbolSelect}
            />
          ))}
        </div>
      </div>
    );
  }

  /* ---- Animated marquee ---- */
  return (
    <div
      ref={scrollRef}
      role="marquee"
      aria-label="Defence stock ticker — decorative; full quotes on the Market Ticker page"
      className={`
        relative overflow-hidden bg-slate-900/70 border-y border-slate-800
        ${compact ? "py-0.5 text-xs" : "py-1 text-sm"} ${className}
      `}
      onMouseEnter={() => {
        scrollRef.current?.style.setProperty(
          "animation-play-state",
          "paused",
        );
      }}
      onMouseLeave={() => {
        scrollRef.current?.style.setProperty(
          "animation-play-state",
          "running",
        );
      }}
    >
      {/* Gradient fade edges */}
      <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />

      <div
        aria-hidden={true}
        className="flex items-center h-full whitespace-nowrap"
        style={{
          animation: "ticker-scroll 30s linear infinite",
        }}
      >
        {/* Duplicate items so the loop is seamless */}
        {[...displayQuotes, ...displayQuotes].map((q, i) => (
          <TickerItem
            key={`${q.symbol}-${i}`}
            quote={q}
            compact={compact}
            onSymbolSelect={onSymbolSelect}
          />
        ))}
      </div>

      {error && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-red-400/70">
          ⚠ {error}
        </span>
      )}
    </div>
  );
}
