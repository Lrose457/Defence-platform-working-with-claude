"use client";

import { useState } from "react";
import StockTicker from "@/components/StockTicker";
import StockLiveChart from "@/components/StockLiveChart";

/**
 * Country-scoped market panel: a ticker limited to contractors listed in
 * this country plus a live price chart for the selected symbol.
 * Client component because ticker selection is interactive state.
 */
export default function CountryMarketPanel({
  symbols,
  selectedSymbol,
}: {
  /** Ticker symbols listed in this country (already filtered upstream). */
  symbols: string[];
  /** Pre-selected symbol (e.g. from ?mkt= deep link). */
  selectedSymbol?: string;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const symbol = picked ?? selectedSymbol ?? symbols[0] ?? null;

  if (symbols.length === 0) return null;

  return (
    <section className="space-y-4 rounded border border-slate-800 bg-slate-900/50 p-4">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
          Listed contractors
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Click a ticker to load its price history. Quotes may be delayed.
        </p>
      </div>
      <StockTicker symbols={symbols} compact onSymbolSelect={setPicked} />
      <StockLiveChart symbol={symbol} height={240} />
    </section>
  );
}
