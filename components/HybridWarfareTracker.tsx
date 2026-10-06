"use client";

/**
 * Longitudinal hybrid-warfare incident table: filter by attacked nation,
 * target type and review status, with free-text search across titles and
 * summaries. Rows come from the server-rendered page (verified + dropped
 * from the materialised table, plus live "possible" queue candidates).
 */

import { useMemo, useState } from "react";
import { formatDateHuman } from "@/lib/format";
import type { HybridWarfareIncident } from "@/components/atlas/atlasData";
import { HYBRID_TARGET_STYLE } from "@/components/atlas/HybridLayer";

/** The tracker also shows 'dropped' rows (the view suppresses those). */
export type TrackedHybridIncident = Omit<HybridWarfareIncident, "status"> & {
  status: "possible" | "verified" | "dropped";
};

const STATUS_BADGE: Record<
  TrackedHybridIncident["status"],
  { cls: string; label: string }
> = {
  verified: {
    cls: "border-emerald-700 bg-emerald-950/60 text-emerald-300",
    label: "Verified",
  },
  possible: {
    cls: "border-amber-700 bg-amber-950/60 text-amber-300",
    label: "Possible",
  },
  dropped: {
    cls: "border-slate-600 bg-slate-800/60 text-slate-400",
    label: "Dropped",
  },
};

const TARGET_ORDER = ["military", "civilian", "dual", "unknown"] as const;

function targetStyleKey(target: string | null): string {
  if (target === "military" || target === "civilian" || target === "dual") {
    return target;
  }
  return "unknown";
}

export default function HybridWarfareTracker({
  incidents,
}: {
  incidents: TrackedHybridIncident[];
}) {
  const [status, setStatus] = useState("all");
  const [target, setTarget] = useState("all");
  const [nation, setNation] = useState("all");
  const [query, setQuery] = useState("");

  const nations = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of incidents) {
      const key = i.attacked_iso3 ?? i.attacked_name ?? "__unattributed";
      const label =
        i.attacked_name ?? i.attacked_iso3 ?? "Unattributed";
      if (!map.has(key)) map.set(key, label);
    }
    return [...map.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [incidents]);

  const counts = useMemo(
    () => ({
      all: incidents.length,
      verified: incidents.filter((i) => i.status === "verified").length,
      possible: incidents.filter((i) => i.status === "possible").length,
      dropped: incidents.filter((i) => i.status === "dropped").length,
      nations: new Set(
        incidents.map((i) => i.attacked_iso3 ?? i.attacked_name).filter(Boolean),
      ).size,
      govResponses: incidents.filter((i) => i.government_response).length,
    }),
    [incidents],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return incidents.filter((i) => {
      if (status !== "all" && i.status !== status) return false;
      if (
        target !== "all" &&
        targetStyleKey(i.target_type) !== target
      ) {
        return false;
      }
      if (nation !== "all") {
        const key = i.attacked_iso3 ?? i.attacked_name ?? "__unattributed";
        if (key !== nation) return false;
      }
      if (q) {
        const haystack = `${i.title} ${i.summary ?? ""} ${i.attacked_name ?? ""} ${i.attacked_iso3 ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [incidents, status, target, nation, query]);

  const selectCls =
    "rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-300";

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex flex-wrap gap-3 text-[11px] font-mono text-slate-400">
        <span className="rounded border border-slate-700 px-2 py-1">
          {counts.all} incidents
        </span>
        <span className="rounded border border-emerald-800 px-2 py-1 text-emerald-400">
          {counts.verified} verified
        </span>
        <span className="rounded border border-amber-800 px-2 py-1 text-amber-400">
          {counts.possible} possible
        </span>
        <span className="rounded border border-slate-700 px-2 py-1">
          {counts.dropped} dropped
        </span>
        <span className="rounded border border-slate-700 px-2 py-1">
          {counts.nations} nations
        </span>
        <span className="rounded border border-slate-700 px-2 py-1">
          {counts.govResponses} gov responses recorded
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[11px] text-slate-500">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
            className={selectCls}
          >
            <option value="all">All ({counts.all})</option>
            <option value="verified">Verified ({counts.verified})</option>
            <option value="possible">Possible ({counts.possible})</option>
            <option value="dropped">Dropped ({counts.dropped})</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-[11px] text-slate-500">
          Target
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="Filter by target type"
            className={selectCls}
          >
            <option value="all">All targets</option>
            {TARGET_ORDER.map((t) => (
              <option key={t} value={t}>
                {HYBRID_TARGET_STYLE[t].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[11px] text-slate-500">
          Nation
          <select
            value={nation}
            onChange={(e) => setNation(e.target.value)}
            aria-label="Filter by attacked nation"
            className={selectCls}
          >
            <option value="all">All nations</option>
            {nations.map((n) => (
              <option key={n.key} value={n.key}>
                {n.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[11px] text-slate-500">
          Search
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="title, summary, nation…"
            aria-label="Search incidents"
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300 placeholder:text-slate-600"
          />
        </label>
        <span className="text-[11px] font-mono text-slate-600">
          {filtered.length} / {incidents.length} shown
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
          No incidents match the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-slate-800">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">First seen</th>
                <th className="px-3 py-2 font-medium">Attacked nation</th>
                <th className="px-3 py-2 font-medium">Target</th>
                <th className="px-3 py-2 font-medium">Incident</th>
                <th className="px-3 py-2 font-medium">Conf.</th>
                <th className="px-3 py-2 font-medium">Domains</th>
                <th className="px-3 py-2 font-medium">Government response</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const badge = STATUS_BADGE[i.status];
                const tStyle =
                  HYBRID_TARGET_STYLE[targetStyleKey(i.target_type)];
                return (
                  <tr
                    key={`${i.status}-${i.id}`}
                    className="border-t border-slate-800 align-top odd:bg-slate-950/40"
                  >
                    <td className="px-3 py-2">
                      <span
                        className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-slate-400">
                      {formatDateHuman(i.first_seen_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                      {i.attacked_name ?? i.attacked_iso3 ?? (
                        <span className="text-slate-600">Unattributed</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span
                        className="inline-flex items-center gap-1 text-[11px]"
                        style={{ color: tStyle.color }}
                      >
                        <span aria-hidden>{tStyle.glyph}</span>
                        {i.target_type ? tStyle.label : "—"}
                      </span>
                    </td>
                    <td className="max-w-md px-3 py-2">
                      {i.source_url ? (
                        <a
                          href={i.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-slate-100 hover:text-blue-400"
                        >
                          {i.title}
                        </a>
                      ) : (
                        <span className="font-medium text-slate-100">
                          {i.title}
                        </span>
                      )}
                      {i.summary && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-500">
                          {i.summary}
                        </p>
                      )}
                      {i.definition_clause && (
                        <p
                          className="mt-0.5 line-clamp-1 text-[10px] text-slate-600"
                          title={i.definition_clause}
                        >
                          {i.definition_clause}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-400">
                      {i.confidence_score != null ? `${i.confidence_score}%` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex max-w-32 flex-wrap gap-1">
                        {(i.domains ?? []).map((d) => (
                          <span
                            key={d}
                            className="rounded bg-slate-800 px-1 py-0.5 text-[9px] text-slate-400"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="max-w-xs px-3 py-2 text-[11px] leading-4 text-slate-400">
                      {i.government_response ? (
                        <span className="line-clamp-3">
                          {i.government_response}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
