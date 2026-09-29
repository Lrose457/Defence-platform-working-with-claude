"use client";

import { useState } from "react";
import StockTicker from "@/components/StockTicker";

const STORAGE_KEY = "defence-ticker-dismissed";
const DISMISS_TTL_MS = 24 * 60 * 60_000; // 24 hours

/**
 * Floating corner widget that embeds a compact StockTicker.
 *
 * • Defaults to bottom-right, z-50 so it floats above the sidebar/main
 * • Dismissal persists in localStorage for 24 h — then it re-appears
 * • A small "Show ticker" button appears in the corner when dismissed,
 *   so the user can bring it back at any time
 * • Respects reduced-motion: falls back to a static scroll when enabled
 */

/* Read dismissal state from localStorage (client-only). */
function getDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const dismissedAt = parseInt(raw, 10);
      if (Date.now() - dismissedAt < DISMISS_TTL_MS) {
        return true;
      }
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return false;
}

export default function StockTickerWidget() {
  const [dismissed, setDismissed] = useState(getDismissed);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setDismissed(true);
  };

  const restore = () => {
    localStorage.removeItem(STORAGE_KEY);
    setDismissed(false);
  };

  /* ---- Dismissed state: tiny restore button in the corner ---- */
  if (dismissed) {
    return (
      <button
        onClick={restore}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5
          px-2.5 py-1.5 rounded-md border border-slate-700
          bg-slate-800/80 text-xs text-slate-400
          hover:text-slate-200 hover:border-slate-600
          transition-all backdrop-blur-sm"
        aria-label="Show defence stock ticker"
        title="Show defence stock ticker"
      >
        <span aria-hidden>📊</span>
        <span>Show ticker</span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-1
        w-[360px] max-w-[calc(100vw-2rem)]"
    >
      <div
        className="flex items-center justify-between px-2 py-1
          text-[10px] uppercase tracking-widest text-slate-500
          border border-slate-800 rounded-t bg-slate-900/80"
      >
        <span className="flex items-center gap-1">
          <span aria-hidden>🛡️</span> Defence market watch
        </span>
        <button
          onClick={dismiss}
          className="text-slate-600 hover:text-slate-300 transition-colors"
          aria-label="Dismiss ticker for 24h"
          title="Dismiss for 24 hours"
        >
          ✕
        </button>
      </div>

      <div className="overflow-hidden rounded-b border border-slate-800 bg-slate-900/80">
        {/* Limit to 8 items in the compact widget */}
        <StockTicker compact limit={8} refreshInterval={60_000} />
      </div>
    </div>
  );
}
