"use client";

import React, { useEffect, useState } from "react";
import { ResponsiveContainer } from "recharts";

type FullscreenChartProps = {
  title: string;
  subtitle?: string;
  attribution?: string;
  children: React.ReactNode;
  /** Chart height inside the normal (non-fullscreen) layout. */
  initialHeight?: number;
};

/**
 * Wraps a chart panel with an expand button. In fullscreen mode the panel
 * becomes a fixed overlay (Escape closes it) and the chart stretches to
 * the viewport, giving users an unobstructed view of the data.
 */
export default function FullscreenChart({
  title,
  subtitle,
  attribution,
  children,
  initialHeight = 300,
}: FullscreenChartProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isFullscreen) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setIsFullscreen(false);
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  const panel = (
    <div
      className={`rounded border bg-slate-900/60 ${
        isFullscreen
          ? "fixed inset-4 z-50 flex flex-col border-slate-600 shadow-2xl"
          : "border-slate-800"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-2.5">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-300">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[10px] text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {attribution && (
            <span className="hidden text-[10px] text-slate-600 sm:inline">{attribution}</span>
          )}
          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            aria-expanded={isFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
            className="rounded border border-slate-700 px-2 py-1 text-[10px] font-mono text-slate-400 hover:border-slate-500 hover:text-slate-200"
          >
            {isFullscreen ? "EXIT ⤡" : "FULLSCREEN ⤢"}
          </button>
        </div>
      </div>
      <div
        className={`p-3 ${isFullscreen ? "min-h-0 flex-1" : ""}`}
        style={isFullscreen ? undefined : { height: initialHeight }}
      >
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );

  return panel;
}
