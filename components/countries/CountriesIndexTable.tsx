"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/**
 * Client-rendered countries index.
 *
 * The data arrives from /api/countries (203 rows + the 61-row view budget
 * fold, ~40 KB JSON) instead of being server-rendered into ~330 KB of HTML.
 * Region grouping and budget formatting match the previous SSR table 1:1;
 * a client-side search filter is the one new affordance.
 */

interface Budget {
  year: number;
  amount_usd: number | null;
  is_estimate: boolean;
}

interface CountryRow {
  id: number;
  name: string;
  iso_code: string;
  region: string;
  latest_budget: Budget | null;
}

function formatBudget(budget: Budget): string {
  if (budget.amount_usd === null) return "Not recorded";
  const amount = budget.amount_usd;
  const value =
    amount >= 1_000_000_000
      ? `$${(amount / 1_000_000_000).toFixed(1)}bn`
      : `$${(amount / 1_000_000).toFixed(0)}m`;
  return `${value} (${budget.year}${budget.is_estimate ? " est." : ""})`;
}

export default function CountriesIndexTable() {
  const [rows, setRows] = useState<CountryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/countries", { cache: "no-store" })
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("Could not load countries")),
      )
      .then((data: { rows: CountryRow[] }) => {
        if (!cancelled) setRows(data.rows ?? []);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.iso_code.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const regions = useMemo(
    () => Array.from(new Set(filtered.map((r) => r.region))).sort(),
    [filtered],
  );

  if (loading) {
    return (
      <div className="rounded border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-500">
        Loading countries…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by country or ISO code…"
        className="w-full max-w-sm rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
      />

      {filtered.length === 0 && (
        <div className="rounded border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
          No countries match this filter.
        </div>
      )}

      <div className="space-y-8">
        {regions.map((region) => (
          <div key={region} className="space-y-3">
            <h2 className="border-l-2 border-blue-600 pl-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
              {region}
            </h2>

            <div className="overflow-hidden rounded border border-slate-800 bg-slate-900/50">
              <table className="w-full border-collapse text-left">
                <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Country</th>
                    <th className="px-3 py-2 font-semibold">ISO</th>
                    <th className="px-3 py-2 font-semibold">Latest budget</th>
                    <th className="px-3 py-2 text-right font-semibold">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800 text-xs">
                  {filtered
                    .filter((country) => country.region === region)
                    .map((country) => (
                      <tr
                        key={country.id}
                        className="group transition-colors hover:bg-slate-800/40"
                      >
                        <td className="px-3 py-2 font-medium">
                          <Link
                            href={`/countries/${country.id}`}
                            className="text-slate-200 transition-colors group-hover:text-blue-400"
                          >
                            {country.name || "Unnamed country"}
                          </Link>
                        </td>

                        <td className="px-3 py-2 font-mono text-slate-500">
                          {country.iso_code || "—"}
                        </td>

                        <td className="px-3 py-2 font-mono text-slate-300">
                          {country.latest_budget
                            ? formatBudget(country.latest_budget)
                            : "Not recorded"}
                        </td>

                        <td className="px-3 py-2 text-right">
                          <Link
                            href={`/contracts?country=${country.id}`}
                            className="text-xs font-medium text-blue-500 transition-colors hover:text-blue-400"
                          >
                            View pipeline →
                          </Link>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
