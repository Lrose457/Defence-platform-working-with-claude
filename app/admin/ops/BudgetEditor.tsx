"use client";

import { useState, useTransition } from "react";
import { updateFreshnessBudget } from "./actions";

/**
 * Inline editor for one freshness budget cell: a small number input with a
 * per-row Save button. Keeps its own optimistic value while the server
 * action round-trips, then surfaces any rejection inline.
 */
export default function BudgetEditor({
  dataset,
  initialHours,
}: {
  dataset: string;
  initialHours: number;
}) {
  const [value, setValue] = useState(String(initialHours));
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = value !== String(initialHours);

  function save() {
    setError(null);
    setSaved(null);
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours < 1 || hours > 8760) {
      setError("1–8760");
      return;
    }
    startTransition(async () => {
      const result = await updateFreshnessBudget(dataset, hours);
      if (result.ok) {
        setSaved(String(hours));
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="number"
        min={1}
        max={8760}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
        className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-right font-mono text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
        aria-label={`Budget hours for ${dataset}`}
      />
      <button
        type="button"
        onClick={save}
        disabled={!dirty || pending}
        className="rounded border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-300 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-30"
      >
        {pending ? "…" : "Save"}
      </button>
      {saved && !dirty && <span className="text-[10px] text-green-400">saved</span>}
      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </span>
  );
}
