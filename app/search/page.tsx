import Link from "next/link";
import { Suspense } from "react";
import { FCRA_DISCLAIMER } from "@/lib/security/privacy";

interface SearchResult {
  entity_id: string;
  entity_type: string;
  entity_name: string;
  entity_group: string;
  identifier: string;
  description: string | null;
}

interface SearchResponse {
  results: SearchResult[];
  disclaimer: string;
  pagination: {
    page: number;
    limit: number;
    totalResults: number;
    totalPages: number;
  };
}

/**
 * Maps an entity_type from the search API to the corresponding
 * Next.js route segment.  This replaces the buggy `type.slice(0, -1)`
 * which produced invalid paths ("companie", "equipmen", etc.).
 */
const entityRouteMap: Record<string, string> = {
  country: "countries",
  company: "companies",
  equipment: "equipment",
  programme: "programmes",
  contract: "contracts",
  source: "sources",
  conflict: "conflicts",
};

/**
 * Maps entity_type to a human-readable collection label for headings.
 */
const entityTypeLabel: Record<string, string> = {
  country: "Countries",
  company: "Companies",
  equipment: "Equipment",
  programme: "Programmes",
  contract: "Contracts",
  source: "Sources",
  conflict: "Conflicts",
};

async function fetchSearchResults(
  query: string,
  type: string,
  page: number,
  limit: number,
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    type,
    page: String(page),
    limit: String(limit),
  });

  const response = await fetch(
    `/api/search?${params}`,
    { next: { revalidate: 0 } },
  );

  if (!response.ok) {
    return {
      results: [],
      disclaimer: FCRA_DISCLAIMER,
      pagination: { page, limit, totalResults: 0, totalPages: 1 },
    };
  }

  const data = await response.json();

  return {
    results: data.results ?? [],
    disclaimer: data.disclaimer ?? FCRA_DISCLAIMER,
    pagination: data.pagination ?? { page, limit, totalResults: data.results?.length ?? 0, totalPages: 1 },
  };
}

function SearchResultsGroup({
  type,
  query,
  page,
  limit,
}: {
  type: string;
  query: string;
  page: number;
  limit: number;
}) {
  return (
    <Suspense fallback={<div className="text-slate-400">Searching…</div>}>
      <SearchResultsList
        type={type}
        query={query}
        page={page}
        limit={limit}
      />
    </Suspense>
  );
}

async function SearchResultsList({
  type,
  query,
  page,
  limit,
}: {
  type: string;
  query: string;
  page: number;
  limit: number;
}) {
  const response = await fetchSearchResults(query, type, page, limit);
  const { results, pagination } = response;

  if (results.length === 0) {
    return (
      <div className="text-center py-12 border border-slate-800 bg-slate-900/30 rounded">
        <p className="text-xl font-mono text-slate-500 uppercase tracking-widest">
          No intelligence records matched
        </p>
        <p className="mt-2 text-xs text-slate-600 font-mono">
          Try searching for a company, country, or system identifier.
        </p>
      </div>
    );
  }

  /*
   * Group results by entity_type for display.
   * Within each group, rank by prefix match (starts-with) first,
   * then alphabetical.
   */
  const grouped: Record<string, SearchResult[]> = {};

  for (const row of results) {
    if (!grouped[row.entity_type]) {
      grouped[row.entity_type] = [];
    }
    grouped[row.entity_type].push(row);
  }

  /* Sort each group: prefix matches first, then alphabetical. */
  for (const groupType of Object.keys(grouped)) {
    grouped[groupType].sort((a, b) => {
      const aName = (a.entity_name || "").toLowerCase();
      const bName = (b.entity_name || "").toLowerCase();

      const aPrefix = aName.startsWith(query.toLowerCase()) ? 0 : 1;
      const bPrefix = bName.startsWith(query.toLowerCase()) ? 0 : 1;

      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      return aName.localeCompare(bName);
    });
  }

  const orderedTypes = Object.keys(grouped).sort((a, b) =>
    (entityTypeLabel[a] ?? a).localeCompare(entityTypeLabel[b] ?? b),
  );

  return (
    <>
      <div className="grid gap-8">
        {orderedTypes.map((groupType) => {
          const items = grouped[groupType];
          const routeBase = entityRouteMap[groupType] ?? groupType;

          return (
            <div key={groupType} className="space-y-3">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 border-l-2 border-blue-600 pl-2">
                {entityTypeLabel[groupType] ??
                  `${groupType.charAt(0).toUpperCase()}${groupType.slice(1)}s`}
              </h2>
              <div className="rounded border border-slate-800 bg-slate-900/50 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Entity Name</th>
                      <th className="px-3 py-2 font-semibold text-right">Identifier</th>
                      <th className="px-3 py-2 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-xs">
                    {items.map((item) => (
                      <tr
                        key={`${item.entity_type}-${item.entity_id}`}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        <td className="px-3 py-2 font-medium text-slate-200">
                          {item.entity_name || "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-500">
                          {item.identifier || item.entity_id || "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Link
                            href={`/${routeBase}/${item.entity_id}`}
                            className="text-xs text-blue-500 hover:text-blue-400 transition-colors font-medium"
                          >
                            ACCESS_RECORD &rarr;
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
            (pageNum) => (
              <Link
                key={pageNum}
                href={`/search?q=${encodeURIComponent(query)}&type=${type}&page=${pageNum}`}
                className={`px-3 py-1 rounded text-sm font-mono ${
                  pageNum === page
                    ? "bg-blue-500 text-slate-950"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {pageNum}
              </Link>
            ),
          )}
        </div>
      )}
    </>
  );
}

export default function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; page?: string };
}) {
  const query = searchParams.q || "";
  const type = searchParams.type || "all";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const limit = 20;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Global Intelligence Search
          </h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Querying across all defence entities, procurement pipelines, and
            legislative records
          </p>
        </div>
        <div className="text-right font-mono">
          <p className="text-[10px] text-slate-500 uppercase">
            Query:{" "}
            <span className="text-blue-400">
              {query || "NULL"}
            </span>
          </p>
          <p className="text-[10px] text-slate-600 mt-1">
            Type: <span className="text-blue-400">{type}</span>
          </p>
        </div>
      </div>

      {query.length > 0 && (
        <SearchResultsGroup type={type} query={query} page={page} limit={limit} />
      )}

      {query.length === 0 && (
        <div className="text-center py-20 space-y-4 border border-slate-800 bg-slate-900/30 rounded">
          <p className="text-xl font-mono text-slate-500 uppercase tracking-widest">
            Enter a search query
          </p>
          <p className="mt-2 text-xs text-slate-600 font-mono">
            Search for a company, country, equipment, programme, contract,
            source, or conflict.
          </p>
        </div>
      )}
    </div>
  );
}
