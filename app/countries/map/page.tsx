import type { Metadata } from "next";
import GlobalDefenseMap from "@/components/GlobalDefenseMap";

export const metadata: Metadata = {
  title: "Global Defence Map",
  description:
    "Choropleth and cartogram views of defence spending, defence burden, change since 2015, and tracked conflicts.",
};

/**
 * One map, four layers.
 *
 * This replaces the previous bespoke spending map. Two defects in that version
 * are worth recording so they are not reintroduced:
 *
 * 1. Its bloc filter (NATO/EU/BRICS/QUAD) read a `blocs` column that does not
 *    exist on the live `countries` table and was hard-set to null, so every
 *    bloc mode rendered every country identically.
 * 2. It resolved "the latest budget" by scanning a globally year-sorted array,
 *    which returns whichever row appeared first rather than each country's own
 *    newest row.
 */
export default function CountriesMapPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Global Defence Map
          </h1>
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Spending, burden, trend and conflict in one projection
          </p>
        </div>
      </div>

      <GlobalDefenseMap initialMetric="spending" />
    </div>
  );
}
