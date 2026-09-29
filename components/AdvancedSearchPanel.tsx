"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type SearchResult = {
  entity_id: number;
  entity_type: string;
  entity_name: string;
  entity_group?: string | null;
  identifier?: string | null;
  description?: string | null;
};

type Props = {
  initialResults?: SearchResult[];
};

const TYPE_LABELS: Record<string, string> = {
  country: "Countries",
  company: "Companies",
  equipment: "Equipment",
  programme: "Programmes",
  contract: "Contracts",
  source: "Sources",
};

const TYPE_PATHS: Record<string, string> = {
  country: "/countries",
  company: "/companies",
  equipment: "/equipment",
  programme: "/programmes",
  contract: "/contracts",
  source: "/sources",
};

export default function AdvancedSearchPanel({
  initialResults = [],
}: Props) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [results, setResults] = useState<SearchResult[]>(initialResults);
  const [loading, setLoading] = useState(false);

  const grouped = useMemo(() => {
    return results.reduce<Record<string, SearchResult[]>>((groups, result) => {
      if (!groups[result.entity_type]) {
        groups[result.entity_type] = [];
      }

      groups[result.entity_type].push(result);
      return groups;
    }, {});
  }, [results]);

  async function submit(event: FormEvent) {
    event.preventDefault();

    const trimmed = query.trim();

    if (!trimmed) {
      setResults([]);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(trimmed)}&type=${encodeURIComponent(
          type,
        )}`,
      );

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();

      setResults(Array.isArray(data.results) ? data.results : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <form
        onSubmit={submit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-[1fr_190px_auto] md:items-end">
          <div>
            <label
              htmlFor="advanced-search"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Search defence intelligence
            </label>

            <input
              id="advanced-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Country, company, programme, equipment, contract or source"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div>
            <label
              htmlFor="advanced-search-type"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Entity type
            </label>

            <select
              id="advanced-search-type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              <option value="all">All entities</option>
              <option value="country">Countries</option>
              <option value="company">Companies</option>
              <option value="equipment">Equipment</option>
              <option value="programme">Programmes</option>
              <option value="contract">Contracts</option>
              <option value="source">Sources</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </form>

      {query.trim() && !loading && (
        <div className="text-sm text-slate-500">
          {results.length} result{results.length === 1 ? "" : "s"} for{" "}
          <span className="font-medium text-slate-700">“{query.trim()}”</span>
        </div>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="font-medium text-slate-800">No matching entities</p>
          <p className="mt-1 text-sm text-slate-500">
            Try a country, company, equipment system, programme or contract.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(grouped).map(([groupType, groupResults]) => (
          <section
            key={groupType}
            className="rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold text-slate-900">
                {TYPE_LABELS[groupType] ?? groupType}
              </h2>

              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                {groupResults.length}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {groupResults.map((result) => {
                const basePath = TYPE_PATHS[result.entity_type];

                return (
                  <Link
                    key={`${result.entity_type}-${result.entity_id}`}
                    href={`${basePath}/${result.entity_id}`}
                    className="block px-5 py-4 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-400"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-medium text-slate-900">
                          {result.entity_name}
                        </div>

                        {result.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                            {result.description}
                          </p>
                        )}
                      </div>

                      <div className="text-xs text-slate-400">
                        {result.entity_group ||
                          result.identifier ||
                          "View intelligence"}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}