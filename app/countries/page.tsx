import Link from "next/link";
import CountriesIndexTable from "@/components/countries/CountriesIndexTable";

/**
 * /countries — country index.
 *
 * Intentionally free of Supabase queries: the 203-row table ships via
 * /api/countries and renders client-side, keeping this page's SSR HTML to
 * the shell (~40 KB) instead of ~330 KB of rows. See CountriesIndexTable.
 */
export default function CountriesPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Global defence countries
          </h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            National coverage across the platform
          </p>
        </div>

        <Link
          href="/countries/map"
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-bold uppercase tracking-tighter text-white transition-colors hover:bg-blue-500"
        >
          Open global map
        </Link>
      </div>

      <CountriesIndexTable />
    </div>
  );
}
