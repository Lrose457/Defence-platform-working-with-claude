"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  StockQuote,
  DefenceSector,
  defenceStockSymbols,
} from "@/lib/stockSymbols";

interface StockTableProps {
  quotes: StockQuote[];
  lastUpdated: number;
  error?: string;
  disclaimer?: string;
}

type SortKey = "symbol" | "name" | "price" | "changePercent" | "change" | "volume" | "marketCap";
type SortDir = "asc" | "desc";

/* ── Formatting helpers ────────────────────────────────────── */

const currencySymbols: Record<string, string> = {
  USD: "$", GBP: "£", EUR: "€", JPY: "¥", KRW: "₩", CAD: "C$", SEK: "kr",
};

function currencySymbol(c: string): string {
  return currencySymbols[c] ?? "";
}

function formatPrice(value: number | null, currency: string): string {
  if (value === null) return "—";
  const sym = currencySymbol(currency);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  }).format(value);
  return sym ? `${sym}${formatted}` : formatted;
}

function formatVolume(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatTime(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
}

function formatChangePct(value: number | null): string {
  if (value === null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

const sectorOptions: DefenceSector[] = [
  "Aerospace", "Naval", "Missiles", "Land", "Electronic Warfare",
  "Cyber", "Propulsion", "Simulation", "Services",
];

function countryFlag(cc: string): string {
  const flags: Record<string, string> = {
    us: "🇺🇸", gb: "🇬🇧", fr: "🇫🇷", de: "🇩🇪", it: "🇮🇹",
    jp: "🇯🇵", kr: "🇰🇷", ca: "🇨🇦", se: "🇸🇪", il: "🇮🇱",
  };
  return flags[cc] ?? "🌐";
}

function MarketStatusBadge({ state }: { state: string }) {
  const configs: Record<string, { label: string; cls: string }> = {
    NORMAL: { label: "Open", cls: "text-green-400 border-green-800 bg-green-950/30" },
    PRE: { label: "Pre", cls: "text-amber-400 border-amber-800 bg-amber-950/30" },
    POST: { label: "Post", cls: "text-amber-400 border-amber-800 bg-amber-950/30" },
    FINAL: { label: "Closed", cls: "text-slate-500 border-slate-700 bg-slate-900/50" },
    PREPRE: { label: "Pre-open", cls: "text-slate-500 border-slate-700 bg-slate-900/50" },
    POSTPOST: { label: "Closed", cls: "text-slate-500 border-slate-700 bg-slate-900/50" },
  };
  const cfg = configs[state] ?? { label: "N/A", cls: "text-slate-500 border-slate-700 bg-slate-900/50" };
  return (
    <span
      className={`text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded border ${cfg.cls}`}
    >
            {cfg.label}
    </span>
  );
}

/* ── Sortable, filterable table ───────────────────────────── */

/* Sortable header button — declared at module scope so React
   doesn't treat it as a component created during render. */
function SortButton({
  label,
  keyName,
  currentKey,
  currentDir,
  onClick,
}: {
  label: string;
  keyName: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onClick: (key: SortKey) => void;
}) {
  return (
    <button
      onClick={() => onClick(keyName)}
      className="text-[10px] font-semibold uppercase tracking-wider
        text-slate-500 hover:text-slate-300 transition-colors
        flex items-center gap-0.5"
    >
      {label}
      {currentKey === keyName && (
        <span className="text-xs">
          {currentDir === "desc" ? "↓" : "↑"}
        </span>
      )}
    </button>
  );
}

export default function StockTable({
  quotes,
  lastUpdated,
  error,
}: StockTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("price");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [sectorFilter, setSectorFilter] = useState<string>("all");

  const sorted = useMemo(() => {
    const filtered =
      sectorFilter === "all" || !sectorFilter
        ? quotes
        : quotes.filter((q) => q.sector === sectorFilter);

        return [...filtered].sort((a, b) => {
      const va = extractSortable(a, sortKey);
      const vb = extractSortable(b, sortKey);

      if (va === null) return 1;
      if (vb === null) return -1;

      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "desc" ? vb - va : va - vb;
      }
      const aStr = String(va);
      const bStr = String(vb);
      return sortDir === "desc" ? bStr.localeCompare(aStr) : aStr.localeCompare(bStr);
    });
  }, [quotes, sortKey, sortDir, sectorFilter]);

  /* Safely extract a sortable value from a quote or our metadata. */
  function extractSortable(q: StockQuote, key: SortKey): number | string | null {
    if (key === "marketCap") {
      const sym = defenceStockSymbols.find((s) => s.symbol === q.symbol);
      return sym?.marketCap ?? null;
    }
    const val = q[key as keyof StockQuote];
    if (val === null || val === undefined) return null;
    if (typeof val === "number" || typeof val === "string") return val;
    return String(val);
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-900 border border-slate-800 rounded px-2 py-1 focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="all">All sectors</option>
            {sectorOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span className="text-[10px] text-slate-500">
            {sorted.length} / {quotes.length} companies
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>Last updated:</span>
          <span className="font-mono text-slate-400">
            {lastUpdated ? formatTime(lastUpdated) : "—"}
          </span>
          {error && <span className="text-red-400/70">⚠ {error}</span>}
        </div>
      </div>

      {/* Table */}
      <div className="rounded border border-slate-800 bg-slate-900/50 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-900/80 border-b border-slate-800">
            <tr>
              <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2"><SortButton label="Company" keyName="name" currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} /></th>
              <th className="px-3 py-2"><SortButton label="Symbol" keyName="symbol" currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} /></th>
              <th className="px-3 py-2 text-right"><SortButton label="Price" keyName="price" currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} /></th>
              <th className="px-3 py-2 text-right"><SortButton label="Change" keyName="changePercent" currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} /></th>
              <th className="px-3 py-2 text-right"><SortButton label="Vol" keyName="volume" currentKey={sortKey} currentDir={sortDir} onClick={toggleSort} /></th>
              <th className="px-3 py-2">Market</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sorted.map((q, i) => {
              const isUp = (q.changePercent ?? 0) >= 0;
              const rowCls = q.price === null
                ? "text-slate-600"
                : isUp ? "text-green-400/80" : "text-red-400/80";
              return (
                <tr key={q.symbol} className="hover:bg-slate-800/40 transition-colors group">
                  <td className="px-3 py-2 text-[11px] text-slate-600 font-mono">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{countryFlag(q.country)}</span>
                      {q.companyId ? (
                        <Link href={`/companies/${q.companyId}`} className="text-slate-200 group-hover:text-blue-400 transition-colors font-medium">{q.name}</Link>
                      ) : (
                        <span className="text-slate-200 font-medium">{q.name}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-600 block mt-0.5">{q.sector} • {q.exchange}</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-400 text-xs">{q.symbol}</td>
                  <td className={`px-3 py-2 text-right font-mono text-sm ${rowCls}`}>{formatPrice(q.price, q.currency)}</td>
                  <td className="px-3 py-2 text-right">
                    {q.price !== null ? (
                      <span className={`inline-flex items-center font-mono text-xs ${rowCls}`}>{isUp ? "▲" : "▼"} {formatPrice(q.change, q.currency)} ({formatChangePct(q.changePercent)})</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-400 text-xs">{formatVolume(q.volume)}</td>
                  <td className="px-3 py-2"><MarketStatusBadge state={q.marketState} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="p-6 text-center text-slate-500">No companies match the selected filter.</div>
        )}
      </div>
        </div>
  );
}
