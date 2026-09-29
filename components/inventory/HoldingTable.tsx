"use client";

import Link from "next/link";
import type { InventoryHolding } from "@/lib/inventory";
import { subCategoryLabel } from "@/lib/inventory";
import { ActivityBadge, EvidenceBadge, StatusPill } from "./badges";

function fmtQty(v: number | null | undefined): string {
  if (v == null) return "—";
  return Number(v).toLocaleString("en-US");
}

export default function HoldingTable({
  holdings,
  showDeployment,
}: {
  holdings: InventoryHolding[];
  showDeployment?: boolean;
}) {
  if (holdings.length === 0) {
    return (
      <div className="rounded border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
        No verified holdings in this category yet. New records enter through
        the ingestion review pipeline.{" "}
        <Link href="/admin/ingestion/import" className="text-blue-400 hover:text-blue-300">
          Queue an import →
        </Link>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded border border-slate-800 bg-slate-900/50">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-3 py-2">System</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-right">Operational</th>
            <th className="px-3 py-2 text-right">Maintenance</th>
            <th className="px-3 py-2">Status</th>
            {showDeployment && <th className="px-3 py-2">Deployment</th>}
            <th className="px-3 py-2">Unit</th>
            <th className="px-3 py-2">Evidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {holdings.map((h) => (
            <tr key={h.holding_id} className="hover:bg-slate-800/40">
              <td className="px-3 py-2 font-medium text-slate-200">
                <Link href={`/equipment/${h.equipment_id}`} className="hover:text-blue-400">
                  {h.equipment_name ?? `Equipment ${h.equipment_id}`}
                </Link>
                {h.hull_name && (
                  <span className="block font-mono text-[11px] text-slate-400">{h.hull_name}</span>
                )}
                {h.variant && (
                  <span className="block text-[11px] text-slate-500">{h.variant}</span>
                )}
              </td>
              <td className="px-3 py-2 text-slate-400">{subCategoryLabel(h.sub_category)}</td>
              <td className="px-3 py-2 text-right font-mono text-slate-200">{fmtQty(h.quantity)}</td>
              <td className="px-3 py-2 text-right font-mono text-emerald-300">{fmtQty(h.operational_qty)}</td>
              <td className="px-3 py-2 text-right font-mono text-amber-300">{fmtQty(h.maintenance_qty)}</td>
              <td className="px-3 py-2"><StatusPill status={h.status} /></td>
              {showDeployment && (
                <td className="px-3 py-2">
                  <ActivityBadge activity={h.activity} area={h.deployment_area} activityName={h.activity_name} />
                </td>
              )}
              <td className="px-3 py-2 text-slate-400">{h.operator_unit ?? "—"}</td>
              <td className="px-3 py-2">
                <div className="flex flex-col gap-1">
                  <EvidenceBadge level={h.evidence_level} />
                  {h.source_title && (
                    <span className="text-[10px] text-slate-500">{h.source_title}</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
