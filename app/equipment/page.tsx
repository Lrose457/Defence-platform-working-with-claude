import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const params = await searchParams;
  const countryFilterRaw = params.country;
  const countryId =
    countryFilterRaw && countryFilterRaw !== "" ? Number(countryFilterRaw) : null;
  const hasCountryFilter = countryId != null && Number.isFinite(countryId);

  const supabase = await createClient();

  const [{ data: equipment, error }, { data: categories }, countryResult, { data: allCountries }] =
    await Promise.all([
      supabase
        .from("equipment")
        .select("id, name, manufacturer, country_of_origin, category_id, confidence, description")
        .order("name")
        .limit(100),
      supabase.from("equipment_categories").select("id, name"),
      hasCountryFilter
        ? supabase
            .from("countries")
            .select("id, name, iso_code")
            .eq("id", countryId)
            .maybeSingle()
        : Promise.resolve({ data: null as { id: number; name: string; iso_code: string | null } | null }),
      supabase.from("countries").select("id, name"),
    ]);
  const countryNameById = new Map((allCountries ?? []).map((c) => [c.id, c.name]));

  /* When filtered by country, restrict to that country's holdings and show
   * which operators hold each system. Unfiltered: annotate rows with all
   * tracked operators so the global list still shows operator coverage.
   * country_equipment is queried with columns that exist in both the base
   * table and the 26g view, so this works whichever the live DB has. */
  const holdingsById = new Map<number, string[]>();
  if (hasCountryFilter) {
    const { data: holdings } = await supabase
      .from("country_equipment_overview")
      .select("equipment_id, operator_unit")
      .eq("country_id", countryId);
    for (const h of holdings ?? []) {
      if (h.equipment_id == null) continue;
      const list = holdingsById.get(h.equipment_id) ?? [];
      if (h.operator_unit) list.push(h.operator_unit);
      holdingsById.set(h.equipment_id, list);
    }
  } else {
    const { data: holdings } = await supabase
      .from("country_equipment")
      .select("equipment_id, country_id");
    for (const h of holdings ?? []) {
      if (h.equipment_id == null) continue;
      const name = countryNameById.get(h.country_id);
      if (!name) continue;
      const list = holdingsById.get(h.equipment_id) ?? [];
      list.push(name);
      holdingsById.set(h.equipment_id, list);
    }
  }

  const rows = (equipment ?? []).filter((item) =>
    hasCountryFilter ? holdingsById.has(item.id) : true,
  );
  const country = countryResult?.data ?? null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold">Capability Inventory</h1>
          <p className="mt-2 text-slate-400">
            Global equipment tracking and capability mapping ({rows.length} assets tracked).
          </p>
        </div>
      </div>

      {hasCountryFilter && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-blue-900/60 bg-blue-950/30 px-4 py-3 text-sm text-blue-200">
          <span>
            {country
              ? `Holdings for ${country.name}${country.iso_code ? ` (${country.iso_code})` : ""} — ${rows.length} system${rows.length === 1 ? "" : "s"}`
              : `Holdings for country ${countryId} — no matching country record`}
          </span>
          <Link
            href={country ? `/countries/${country.id}` : "/countries"}
            className="text-xs text-blue-400 underline hover:text-blue-300"
          >
            ← Back to country profile
          </Link>
        </div>
      )}

      {error && (
        <div className="rounded border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">
          {error.message}
        </div>
      )}

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <table className="w-full">
          <thead className="text-left border-b border-slate-800">
            <tr>
              <th className="pb-3">System</th>
              <th className="pb-3">Category</th>
              <th className="pb-3">Manufacturer</th>
              <th className="pb-3">Origin</th>
              <th className="pb-3">Operators</th>
              <th className="pb-3">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((item) => {
              const operators = holdingsById.get(item.id) ?? [];
              return (
                <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="py-4 font-medium">
                    <Link href={`/equipment/${item.id}`} className="hover:text-blue-400 transition-colors">
                      {item.name || "Unknown"}
                    </Link>
                  </td>
                  <td className="py-4">
                    <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">
                      {(item.category_id != null && categories?.find((c) => c.id === item.category_id)?.name) || "N/A"}
                    </span>
                  </td>
                  <td className="py-4 text-sm text-slate-400">{item.manufacturer || "N/A"}</td>
                  <td className="py-4 text-sm text-slate-300">{item.country_of_origin || "Unknown"}</td>
                  <td className="py-4 text-sm text-slate-400">
                    {operators.length === 0 ? (
                      hasCountryFilter ? "Recorded — unit not disclosed" : "—"
                    ) : hasCountryFilter ? (
                      operators[0]
                    ) : (
                      <>
                        {operators[0]}
                        {operators.length > 1 && ` +${operators.length - 1} more`}
                      </>
                    )}
                  </td>
                  <td className="py-4 text-xs font-mono text-slate-400">{item.confidence || "Not recorded"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-4 text-sm text-slate-500">
            {hasCountryFilter
              ? country
                ? `No tracked holdings for ${country.name} yet. Holdings appear here once recorded in the country inventory.`
                : "No holdings found for this country."
              : "No equipment is currently tracked in the database."}
          </p>
        )}
      </div>
    </div>
  );
}
