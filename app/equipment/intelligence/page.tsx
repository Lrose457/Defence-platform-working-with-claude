import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Equipment = {
  equipment_id: number;
  equipment_name: string;
  country_count: number;
  total_reported_quantity: number;
  country_inventory_records: number;
  contract_count: number;
  company_count: number;
  contract_country_count: number;
  programme_count: number;
  contract_value: number;
  intelligence_change_count: number;
};

function money(value: number | null) {
  if (!value) return "—";

  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}bn`;
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}m`;
  }

  return `$${value.toLocaleString()}`;
}

export default async function EquipmentIntelligencePage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("equipment_intelligence_summary_v2")
    .select("*")
    .order("equipment_name");

  const equipment = (data || []) as Equipment[];

  const totalSystems = equipment.length;

  const totalCountries = equipment.reduce(
    (sum, row) => sum + Number(row.country_count || 0),
    0,
  );

  const totalContracts = equipment.reduce(
    (sum, row) => sum + Number(row.contract_count || 0),
    0,
  );

  const totalValue = equipment.reduce(
    (sum, row) => sum + Number(row.contract_value || 0),
    0,
  );

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-7 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/equipment"
          className="text-xs font-medium text-slate-500 hover:text-cyan-300"
        >
          ← Equipment
        </Link>

        <header className="mt-5 mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Equipment intelligence
          </p>

          <h1 className="mt-2 text-3xl font-semibold text-white">
            Equipment intelligence
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Explore equipment holdings, country coverage, procurement
            relationships and source-backed historical changes.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Systems tracked" value={totalSystems} />
          <Metric label="Country relationships" value={totalCountries} />
          <Metric label="Contracts" value={totalContracts} />
          <Metric label="Recorded value" value={money(totalValue)} />
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-300">
            {error.message}
          </div>
        )}

        <section className="mt-8 rounded-2xl border border-slate-800 bg-[#071225] p-5 sm:p-7">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">
              Equipment intelligence
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Current relationships represented in the database.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-250 text-left text-sm">
              <caption className="sr-only">
                Equipment intelligence summary
              </caption>

              <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-3">Equipment</th>
                  <th scope="col" className="px-3 py-3">Countries</th>
                  <th scope="col" className="px-3 py-3">Reported quantity</th>
                  <th scope="col" className="px-3 py-3">Contracts</th>
                  <th scope="col" className="px-3 py-3">Companies</th>
                  <th scope="col" className="px-3 py-3">Programmes</th>
                  <th scope="col" className="px-3 py-3">Contract value</th>
                  <th scope="col" className="px-3 py-3">Changes</th>
                </tr>
              </thead>

              <tbody>
                {equipment.map((row) => (
                  <tr
                    key={row.equipment_id}
                    className="border-b border-slate-800/70 last:border-0"
                  >
                    <td className="px-3 py-4">
                      <Link
                        href={`/equipment/${row.equipment_id}`}
                        className="font-semibold text-slate-200 hover:text-cyan-300"
                      >
                        {row.equipment_name}
                      </Link>
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {row.country_count}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {row.total_reported_quantity
                        ? row.total_reported_quantity.toLocaleString()
                        : "—"}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {row.contract_count}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {row.company_count}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {row.programme_count}
                    </td>

                    <td className="px-3 py-4 text-white">
                      {money(row.contract_value)}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {row.intelligence_change_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#071225] p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </div>

      <div className="mt-3 text-3xl font-semibold text-white">
        {value}
      </div>
    </div>
  );
}