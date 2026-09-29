"use client";

import type { InventoryHolding } from "@/lib/inventory";
import { BRANCH_LABELS, SUB_CATEGORIES_BY_BRANCH } from "@/lib/inventory";
import { subCategoryLabel } from "@/lib/inventory";
import type { ServiceBranch } from "@/lib/inventory";
import HoldingTable from "./HoldingTable";

export default function BranchSection({
  branch,
  holdings,
  anchor,
}: {
  branch: ServiceBranch;
  holdings: InventoryHolding[];
  anchor: string;
}) {
  const slugs = SUB_CATEGORIES_BY_BRANCH[branch] ?? [];
  const groups = slugs
    .map((slug) => ({
      slug,
      items: holdings.filter((h) => (h.sub_category ?? "uncategorised") === slug),
    }))
    .filter((g) => g.items.length > 0);
  const uncategorised = holdings.filter(
    (h) => !h.sub_category || !(SUB_CATEGORIES_BY_BRANCH[branch] ?? []).includes(h.sub_category),
  );
  const op = holdings.reduce((s, h) => s + (h.operational_qty ?? 0), 0);
  const mn = holdings.reduce((s, h) => s + (h.maintenance_qty ?? 0), 0);

  return (
    <section id={anchor} className="scroll-mt-24 space-y-4">
      <div className="flex items-end justify-between border-b border-slate-800 pb-2">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-widest text-white">{BRANCH_LABELS[branch]}</h2>
          <p className="font-mono text-[11px] text-slate-500">
            {holdings.length} holdings · {op.toLocaleString()} operational · {mn.toLocaleString()} in maintenance
          </p>
        </div>
      </div>
      {holdings.length === 0 ? (
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
          No verified {BRANCH_LABELS[branch].toLowerCase()} holdings are recorded for this country yet.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.slug} className="space-y-2">
              <h3 className="border-l-2 border-blue-600 pl-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {subCategoryLabel(g.slug)} · {g.items.length}
              </h3>
              <HoldingTable holdings={g.items} showDeployment={branch !== "army"} />
            </div>
          ))}
          {uncategorised.length > 0 && (
            <div className="space-y-2">
              <h3 className="border-l-2 border-slate-600 pl-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Uncategorised · {uncategorised.length}
              </h3>
              <HoldingTable holdings={uncategorised} showDeployment={branch !== "army"} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
