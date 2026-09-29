"use client";

import { ACTIVITY_LABELS } from "@/lib/inventory";

const TONE: Record<string, string> = {
  operational: "border-emerald-800 bg-emerald-950/40 text-emerald-300",
  maintenance: "border-amber-800 bg-amber-950/40 text-amber-300",
  ordered: "border-sky-800 bg-sky-950/40 text-sky-300",
  retired: "border-slate-700 bg-slate-900 text-slate-400",
  unknown: "border-slate-700 bg-slate-950 text-slate-500",
};

export function StatusPill({ status }: { status: string | null }) {
  const key = (status ?? "unknown").toLowerCase();
  const tone = TONE[key] ?? TONE.unknown;
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone}`}>
      {label}
    </span>
  );
}

const ACTIVITY_TONE: Record<string, string> = {
  "conflict-operation": "border-red-800 bg-red-950/40 text-red-300",
  "training-exercise": "border-sky-800 bg-sky-950/40 text-sky-300",
  "patrol-presence": "border-blue-800 bg-blue-950/40 text-blue-300",
  transit: "border-slate-700 bg-slate-900 text-slate-300",
  "maintenance-refit": "border-amber-800 bg-amber-950/40 text-amber-300",
  homeport: "border-slate-700 bg-slate-900 text-slate-400",
  undisclosed: "border-slate-800 bg-slate-950 text-slate-500",
};

export function ActivityBadge({
  activity,
  area,
  activityName,
}: {
  activity: string | null;
  area: string | null;
  activityName: string | null;
}) {
  const key = (activity ?? "undisclosed").toLowerCase();
  const tone = ACTIVITY_TONE[key] ?? ACTIVITY_TONE.undisclosed;
  const label =
    ACTIVITY_LABELS[key as keyof typeof ACTIVITY_LABELS] ?? "Undisclosed";
  return (
    <div className="space-y-1">
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone}`}>
        {label}
      </span>
      <p className="text-xs text-slate-300">{area || "Area not disclosed"}</p>
      {activityName && (
        <p className="text-[11px] text-slate-500">{activityName}</p>
      )}
    </div>
  );
}

const EVIDENCE_TONE: Record<string, string> = {
  primary_source: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/20",
  corroborated: "text-cyan-300 bg-cyan-500/10 ring-cyan-500/20",
  single_source: "text-amber-300 bg-amber-500/10 ring-amber-500/20",
  inferred: "text-slate-400 bg-slate-500/10 ring-slate-500/20",
  demonstration: "text-purple-300 bg-purple-500/10 ring-purple-500/20",
  unverified: "text-rose-300 bg-rose-500/10 ring-rose-500/20",
};

export function EvidenceBadge({ level }: { level: string | null }) {
  const key = (level ?? "unverified").toLowerCase();
  const tone = EVIDENCE_TONE[key] ?? EVIDENCE_TONE.unverified;
  const label = key.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ring-1 ${tone}`}>
      {label}
    </span>
  );
}
