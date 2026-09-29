"use client";

import type { InventoryHolding } from "@/lib/inventory";
import { BranchDonut, BranchReadinessBars, BranchCards, TypeBars } from "./chartsInner";

export default function ReadinessStrip({ holdings }: { holdings: InventoryHolding[] }) {
  if (holdings.length === 0) {
    return (
      <div className="rounded border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
        Readiness infographics will appear once verified holdings are ingested for this country.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <BranchDonut holdings={holdings} />
      <BranchReadinessBars holdings={holdings} />
      <BranchCards holdings={holdings} />
      <TypeBars holdings={holdings} />
    </div>
  );
}
