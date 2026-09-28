"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import FullscreenChart from "@/components/FullscreenChart";

interface HistoryResponse {
  symbol: string;
  timestamps: number[];
  closes: number[];
  currency: string;
  error?: string;
}

/**
 * Live daily-close price chart for one ticker symbol, backed by
 * GET /api/stocks/history. Wrapped in FullscreenChart for expand-to-fullscreen.
 */
export default function StockLiveChart({
  symbol,
  height = 260,
}: {
  symbol: string | null;
  height?: number;
}) {
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/stocks/history?symbol=${encodeURIComponent(symbol)}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as HistoryResponse;
        if (!cancelled) setHistory(json);
      } catch {
        if (!cancelled) {
          setHistory({
            symbol,
            timestamps: [],
            closes: [],
            currency: "",
            error: "Failed to load price history.",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  /* Only show history that belongs to the currently selected symbol —
   * stale results from the previous symbol are ignored until replaced. */
  const shown = history && history.symbol === symbol ? history : null;

  const points =
    shown?.timestamps.map((t, i) => ({
      date: new Date(t).toISOString().slice(0, 10),
      close: shown.closes[i],
    })) ?? [];

  return (
    <FullscreenChart
      title={symbol ? `${symbol} · daily close` : "Price history"}
      subtitle="~6 months, daily close. Free-tier candles may be delayed."
      initialHeight={height}
    >
      {loading && points.length === 0 ? (
        <div className="flex h-full items-center justify-center text-xs text-slate-500">
          <span className="animate-pulse">Loading price history…</span>
        </div>
      ) : points.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-xs text-slate-500">
          <span>
            {shown?.error ??
              (symbol ? "No price history available." : "Select a ticker to load its price history.")}
          </span>
        </div>
      ) : (
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickFormatter={(v: string) => v.slice(2)}
            minTickGap={40}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 10 }}
            domain={["auto", "auto"]}
            width={56}
            tickFormatter={(v: number) =>
              v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`
            }
          />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 4,
              fontSize: 12,
            }}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, "Close"]}
          />
          <Line
            type="monotone"
            dataKey="close"
            stroke="#22d3ee"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      )}
    </FullscreenChart>
  );
}
