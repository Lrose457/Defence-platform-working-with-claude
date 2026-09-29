"use client";

import { BRANCH_LABELS, SUB_CATEGORIES_BY_BRANCH } from "@/lib/inventory";
import { subCategoryLabel, summariseByBranch } from "@/lib/inventory";
import type { InventoryHolding, ServiceBranch } from "@/lib/inventory";
import { Bar, BarChart, CartesianGrid, Cell } from "recharts";
import { Legend, Pie, PieChart } from "recharts";
import { ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const OP = "#10b981";
const MAINT = "#f59e0b";

const COLORS: Record<string, string> = {
  army: "#22c55e",
  navy: "#38bdf8",
  air_force: "#a78bfa",
  joint: "#94a3b8",
};

export function BranchDonut({ holdings }: { holdings: InventoryHolding[] }) {
  const byBranch = summariseByBranch(holdings);
  const data = Object.entries(byBranch).map(([key, t]) => ({
    name: BRANCH_LABELS[key as ServiceBranch] ?? key,
    key,
    value: t.total || t.holdings,
  }));
  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-[10px] uppercase tracking-widest text-slate-500">Holdings by branch</p>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
              {data.map((d) => (
                <Cell key={d.key} fill={COLORS[d.key] ?? "#64748b"} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function BranchReadinessBars({ holdings }: { holdings: InventoryHolding[] }) {
  const byBranch = summariseByBranch(holdings);
  const data = Object.entries(byBranch).map(([branch, t]) => ({
    branch: BRANCH_LABELS[branch as ServiceBranch] ?? branch,
    Operational: t.operational,
    Maintenance: t.maintenance,
  }));
  const op = Object.values(byBranch).reduce((s, t) => s + t.operational, 0);
  const mn = Object.values(byBranch).reduce((s, t) => s + t.maintenance, 0);
  const pct = op + mn > 0 ? Math.round((op / (op + mn)) * 100) : null;
  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-[10px] uppercase tracking-widest text-slate-500">
        Operational vs maintenance
        {pct != null && <span className="ml-2 font-mono text-emerald-300">{pct}% ready</span>}
      </p>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} />
            <YAxis type="category" dataKey="branch" tick={{ fill: "#94a3b8", fontSize: 10 }} width={80} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Operational" stackId="a" fill={OP} />
            <Bar dataKey="Maintenance" stackId="a" fill={MAINT} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
export function BranchCards({ holdings }: { holdings: InventoryHolding[] }) {
  const byBranch = summariseByBranch(holdings);
  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-[10px] uppercase tracking-widest text-slate-500">Branch cards</p>
      <div className="mt-2 space-y-2">
        {Object.entries(byBranch).map(([b, t]) => {
          const denom = t.operational + t.maintenance;
          const pct = denom > 0 ? Math.round((t.operational / denom) * 100) : null;
          return (
            <div key={b} className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-300">
                {BRANCH_LABELS[b as ServiceBranch] ?? b}
              </span>
              <span className="font-mono text-slate-400">
                {t.holdings} holdings · <span className="text-emerald-300">{t.operational.toLocaleString()}</span>
                {" / "}<span className="text-amber-300">{t.maintenance.toLocaleString()}</span>
                {pct != null && <span className="ml-2 text-slate-500">{pct}%</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TypeBars({ holdings }: { holdings: InventoryHolding[] }) {
  const rows: { name: string; Operational: number; Maintenance: number }[] = [];
  const branches: ServiceBranch[] = ["army", "navy", "air_force", "joint"];
  for (const branch of branches) {
    for (const slug of SUB_CATEGORIES_BY_BRANCH[branch] ?? []) {
      const items = holdings.filter((h) => h.sub_category === slug);
      if (items.length === 0) continue;
      const op = items.reduce((s, h) => s + (h.operational_qty ?? 0), 0);
      const mn = items.reduce((s, h) => s + (h.maintenance_qty ?? 0), 0);
      if (op + mn === 0) continue;
      rows.push({ name: subCategoryLabel(slug), Operational: op, Maintenance: mn });
    }
  }
  if (rows.length === 0) return null;
  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 p-4 lg:col-span-3">
      <p className="text-[10px] uppercase tracking-widest text-slate-500">Operational vs maintenance by equipment type</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={70} />
            <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Operational" stackId="a" fill={OP} />
            <Bar dataKey="Maintenance" stackId="a" fill={MAINT} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


