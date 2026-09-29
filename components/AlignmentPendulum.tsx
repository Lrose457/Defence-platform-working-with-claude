"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";

type Position = { id: number; name: string; position: number };

/**
 * Pendulum alignment infographic: countries plotted on an arc from
 * Western-aligned (left) through hedging (centre) to non-Western-aligned
 * (right). Pure SVG, no chart dependency — cheap and fully themeable.
 * Position values are computed server-side from supplier-bloc data; this
 * component only renders them.
 */
export default function AlignmentPendulum({ positions }: { positions: Position[] }) {
  const [hovered, setHovered] = useState<Position | null>(null);

  const W = 900;
  const H = 260;
  const cx = W / 2;
  const cy = 220;
  const r = 180;

  const points = useMemo(
    () =>
      positions.map((p) => {
        /* 0 → 180° across the arc; 50 hangs at the bottom centre. */
        const theta = (p.position / 100) * Math.PI;
        return {
          ...p,
          x: cx - r * Math.cos(theta),
          y: cy - r * Math.sin(theta),
        };
      }),
    [positions],
  );

  if (points.length === 0) {
    return (
      <p className="mt-3 text-xs text-slate-500">
        No countries can be positioned yet — supplier-bloc records are needed.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Pendulum alignment model: countries plotted from Western-aligned to non-Western-aligned"
      >
        {/* Arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="#1e293b"
          strokeWidth={2}
        />
        {/* Zone bands */}
        {[
          { from: 0, to: 25, label: "Aligned (West)", color: "#3b82f6" },
          { from: 25, to: 40, label: "Leaning", color: "#0ea5e9" },
          { from: 40, to: 60, label: "Hedging", color: "#64748b" },
          { from: 60, to: 75, label: "Leaning", color: "#f59e0b" },
          { from: 75, to: 100, label: "Aligned (East)", color: "#ef4444" },
        ].map((zone) => {
          const a1 = (zone.from / 100) * Math.PI;
          const a2 = (zone.to / 100) * Math.PI;
          const x1 = cx - r * Math.cos(a1);
          const y1 = cy - r * Math.sin(a1);
          const x2 = cx - r * Math.cos(a2);
          const y2 = cy - r * Math.sin(a2);
          return (
            <line
              key={zone.label}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={zone.color}
              strokeWidth={4}
              strokeOpacity={0.55}
            />
          );
        })}
        {/* Pivot */}
        <circle cx={cx} cy={cy} r={4} fill="#475569" />
        {/* Country nodes — de-overlap by nudging duplicates along the arc */}
        {points.map((p) => {
          const sameArc = points.filter(
            (q) => Math.abs(q.position - p.position) < 2,
          );
          const dupIndex = sameArc.findIndex((q) => q.id === p.id);
          const theta = (p.position / 100) * Math.PI;
          const rr = r + (dupIndex > 0 ? dupIndex * 9 : 0);
          const x = cx - rr * Math.cos(theta);
          const y = cy - rr * Math.sin(theta);
          const isHovered = hovered?.id === p.id;
          return (
            <g key={p.id}>
              <circle
                cx={x}
                cy={y}
                r={isHovered ? 6 : 4}
                fill={isHovered ? "#38bdf8" : "#94a3b8"}
                onMouseEnter={() => setHovered(p)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                <title>{`${p.name} — alignment ${p.position}/100`}</title>
              </circle>
              {isHovered && (
                <text x={x} y={y - 12} textAnchor="middle" fontSize={11} fill="#e2e8f0">
                  {p.name}
                </text>
              )}
            </g>
          );
        })}
        {/* End labels */}
        <text x={cx - r} y={cy + 18} textAnchor="middle" fontSize={10} fill="#64748b">
          Western-aligned
        </text>
        <text x={cx} y={cy + 22} textAnchor="middle" fontSize={10} fill="#64748b">
          Hedging
        </text>
        <text x={cx + r} y={cy + 18} textAnchor="middle" fontSize={10} fill="#64748b">
          Non-Western-aligned
        </text>
      </svg>
      {hovered && (
        <Link
          href={`/countries/${hovered.id}`}
          className="mt-2 inline-block rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-blue-700"
        >
          {hovered.name} · alignment {hovered.position}/100 — open dossier →
        </Link>
      )}
    </div>
  );
}
