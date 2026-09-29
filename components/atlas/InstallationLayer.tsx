"use client";

/**
 * Military installations layer: airfields, naval bases, ports, missile and
 * radar sites. Markers are shaped and coloured by type; hovering shows the
 * facility detail and its source link.
 */

import { useState } from "react";
import type { GeoProjection } from "d3-geo";
import type { AtlasInstallation } from "@/components/atlas/atlasData";

/** Marker style per installation type; shared with WorldAtlas's legend. */
export const INSTALLATION_TYPE_STYLE: Record<
  string,
  { color: string; glyph: string; label: string }
> = {
  airfield: { color: "#f59e0b", glyph: "✈", label: "Airfield" },
  naval_base: { color: "#38bdf8", glyph: "⚓", label: "Naval base" },
  army_base: { color: "#4ade80", glyph: "▲", label: "Army base" },
  port: { color: "#22d3ee", glyph: "⚓", label: "Port" },
  missile_site: { color: "#ef4444", glyph: "◆", label: "Missile site" },
  radar: { color: "#a78bfa", glyph: "◉", label: "Radar" },
  other: { color: "#94a3b8", glyph: "●", label: "Other" },
};

const TYPE_STYLE = INSTALLATION_TYPE_STYLE;

export default function InstallationLayer({
  installations,
  projection,
  zoom,
  onHover,
  onLeave,
  error,
}: {
  installations: AtlasInstallation[];
  projection: GeoProjection;
  zoom: number;
  onHover: (installation: AtlasInstallation, x: number, y: number) => void;
  onLeave: () => void;
  error: string | null;
}) {
  const [openId, setOpenId] = useState<number | null>(null);

  const points = installations
    .map((inst) => {
      const xy = projection([inst.lng, inst.lat]);
      return xy ? { inst, x: xy[0], y: xy[1] } : null;
    })
    .filter((p): p is { inst: AtlasInstallation; x: number; y: number } => p !== null);

  if (installations.length === 0 && error) {
    return (
      <g>
        <text x={20} y={88} fill="#f59e0b" fontSize={11}>
          Installations layer unavailable: {error}
        </text>
      </g>
    );
  }

  return (
    <g>
      {points.map(({ inst, x, y }) => {
        const style = TYPE_STYLE[inst.type] ?? TYPE_STYLE.other;
        const open = openId === inst.id;
        return (
          <g key={inst.id}>
            <circle
              cx={x}
              cy={y}
              r={4.5 / zoom}
              fill={style.color}
              fillOpacity={0.9}
              stroke="#020617"
              strokeWidth={0.8 / zoom}
              className="cursor-pointer"
              onMouseEnter={(e) => {
                const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                onHover(inst, e.clientX - rect.left, e.clientY - rect.top);
              }}
              onMouseLeave={() => {
                onLeave();
                setOpenId(null);
              }}
              onClick={() => setOpenId(open ? null : inst.id)}
            />
            {/* Pin the glyph so it stays legible while zooming. */}
            <text
              x={x}
              y={y + 3 / zoom}
              textAnchor="middle"
              fontSize={7 / zoom}
              pointerEvents="none"
            >
              {style.glyph}
            </text>
            {open && (
              <foreignObject x={x + 8 / zoom} y={y - 30 / zoom} width={240} height={120}>
                <div className="rounded border border-amber-800 bg-slate-950/95 p-2 text-[11px] shadow-xl">
                  <p className="font-medium text-slate-100">{inst.name}</p>
                  <p className="text-[10px] text-slate-400">
                    {style.label} · {inst.status ?? "status n/a"} ·{" "}
                    {inst.country_name ?? `Country ${inst.country_id}`}
                  </p>
                  {inst.notes && (
                    <p className="mt-1 text-[10px] text-slate-400">{inst.notes}</p>
                  )}
                  {inst.source_url && (
                    <a
                      href={inst.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-blue-500 hover:text-blue-400"
                    >
                      Source →
                    </a>
                  )}
                </div>
              </foreignObject>
            )}
          </g>
        );
      })}
    </g>
  );
}
