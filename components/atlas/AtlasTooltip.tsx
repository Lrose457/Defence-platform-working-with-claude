/** Hover intelligence panel for the global atlas. */

import Link from "next/link";
import { sphereFor } from "@/lib/atlas/sphereOfInfluence";
import type { AtlasCountry, AtlasConflict } from "@/components/atlas/atlasData";

export interface TrackedInfo {
  country: AtlasCountry;
  budget: { amount: number | null; year: number | null } | undefined;
  conflicts: AtlasConflict[];
  alpha3: string | null;
}

export default function AtlasTooltip({
  info,
  fallbackName,
}: {
  info: TrackedInfo | null;
  fallbackName: string | null;
}) {
  if (!info) {
    return (
      <div>
        <p className="font-medium text-slate-200">{fallbackName}</p>
        <p className="mt-1 text-slate-500">Not tracked in the platform.</p>
      </div>
    );
  }

  const { country, budget, conflicts, alpha3 } = info;

  return (
    <div>
      <p className="font-medium text-slate-100">{country.name}</p>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">
        {sphereFor(alpha3)}
        {country.region ? ` · ${country.region}` : ""}
      </p>
      <div className="mt-2 space-y-1 text-slate-300">
        <p>
          <span className="text-slate-500">Budget: </span>
          {budget?.amount
            ? `$${(budget.amount / 1e9).toFixed(1)}bn${budget.year ? ` (${budget.year})` : ""}`
            : "Not recorded"}
        </p>
        <p>
          <span className="text-slate-500">Conflicts: </span>
          {conflicts.length === 0 ? (
            "None tracked"
          ) : (
            <span>
              {conflicts.slice(0, 3).map((c, i) => (
                <span key={c.conflict_id}>
                  {i > 0 ? ", " : ""}
                  {c.name}
                  {c.intensity_level != null ? ` (L${c.intensity_level})` : ""}
                </span>
              ))}
              {conflicts.length > 3 ? ` +${conflicts.length - 3}` : ""}
            </span>
          )}
        </p>
      </div>
      <Link
        href={`/countries/${country.id}`}
        className="pointer-events-auto mt-2 inline-block text-[11px] text-blue-500 hover:text-blue-400"
      >
        Open country profile →
      </Link>
    </div>
  );
}
