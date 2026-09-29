"use client";

import Link from "next/link";
import { CAPACITY_STATE_LABELS } from "@/lib/inventory";
import { wingCapacityState } from "@/lib/inventory";
import { ActivityBadge, EvidenceBadge } from "./badges";

export type WingRow = {
  wing_id: number;
  wing_name: string | null;
  carrier_hull: string | null;
  carrier_class: string | null;
  rated_capacity: number | null;
  current_aircraft_count: number | null;
  deployment_area: string | null;
  activity: string | null;
  activity_name: string | null;
  evidence_level: string | null;
  aircraft: { equipment_id: number; equipment_name: string | null; quantity: number | null }[];
};

const TONE: Record<string, string> = {
  full: "border-emerald-800 bg-emerald-950/40 text-emerald-300",
  partial: "border-amber-800 bg-amber-950/40 text-amber-300",
  "under-strength": "border-red-800 bg-red-950/40 text-red-300",
  unknown: "border-slate-700 bg-slate-950 text-slate-500",
};

export default function CarrierAirWingCard({ wings }: { wings: WingRow[] }) {
  if (wings.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="border-l-2 border-sky-600 pl-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
        Carrier air wings · {wings.length}
      </h3>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {wings.map((w) => {
          const state = wingCapacityState(w.rated_capacity, w.current_aircraft_count);
          const pct =
            w.rated_capacity && w.current_aircraft_count != null && w.rated_capacity > 0
              ? Math.round((w.current_aircraft_count / w.rated_capacity) * 100)
              : null;
          return (
            <div key={w.wing_id} className="rounded border border-slate-800 bg-slate-900/50 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-100">{w.wing_name ?? `Wing ${w.wing_id}`}</p>
                  <p className="text-xs text-slate-500">
                    {w.carrier_hull ? `${w.carrier_hull} · ` : ""}
                    {w.carrier_class ?? "Carrier not linked"}
                  </p>
                </div>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TONE[state]}`}>
                  {CAPACITY_STATE_LABELS[state]}
                  {pct != null ? ` · ${pct}%` : ""}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full ${state === "full" ? "bg-emerald-500" : state === "partial" ? "bg-amber-500" : state === "under-strength" ? "bg-red-500" : "bg-slate-600"}`}
                  style={{ width: `${pct != null ? Math.min(100, pct) : 0}%` }}
                />
              </div>
              <p className="font-mono text-[11px] text-slate-500">
                {(w.current_aircraft_count ?? "—").toString()} / {(w.rated_capacity ?? "—").toString()} aircraft
              </p>
              <ActivityBadge activity={w.activity} area={w.deployment_area} activityName={w.activity_name} />
              {w.aircraft.length > 0 && (
                <ul className="divide-y divide-slate-800 rounded border border-slate-800 text-xs">
                  {w.aircraft.map((a) => (
                    <li key={a.equipment_id} className="flex items-center justify-between px-3 py-1.5">
                      <Link href={`/equipment/${a.equipment_id}`} className="text-slate-300 hover:text-blue-400">
                        {a.equipment_name ?? `Equipment ${a.equipment_id}`}
                      </Link>
                      <span className="font-mono text-slate-500">×{a.quantity ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
              <EvidenceBadge level={w.evidence_level} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
