import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Company = {
  company_id: number;
  company_name: string;
  headquarters_country: string | null;
  company_type: string | null;
  ownership_type: string | null;
  data_confidence: string | null;
  contract_count: number;
  valued_contract_count: number;
  total_contract_value: number;
  country_count: number;
  programme_count: number;
  procurement_event_count: number;
  high_importance_event_count: number;
  latest_contract_date: string | null;
  latest_procurement_date: string | null;
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

export default async function CompanyAnalyticsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("company_benchmark_summary")
    .select("*")
    .order("total_contract_value", {
      ascending: false,
      nullsFirst: false,
    });

  const companies = (data || []) as Company[];

  const totalValue = companies.reduce(
    (sum, company) =>
      sum + Number(company.total_contract_value || 0),
    0,
  );

  const totalContracts = companies.reduce(
    (sum, company) =>
      sum + Number(company.contract_count || 0),
    0,
  );

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-7 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/companies"
          className="text-xs font-medium text-slate-500 hover:text-cyan-300"
        >
          ← Companies
        </Link>

        <header className="mt-5 mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Company intelligence
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Defence company analytics
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Compare defence companies using recorded contracts,
            procurement activity, customer-country relationships and
            programme exposure.
          </p>
        </header>

        <section
          aria-label="Company intelligence metrics"
          className="grid gap-4 sm:grid-cols-3"
        >
          <div className="rounded-2xl border border-slate-800 bg-[#071225] p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Companies
            </div>

            <div className="mt-3 text-3xl font-semibold text-white">
              {companies.length}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#071225] p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Recorded contracts
            </div>

            <div className="mt-3 text-3xl font-semibold text-white">
              {totalContracts}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#071225] p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Recorded contract value
            </div>

            <div className="mt-3 text-3xl font-semibold text-cyan-300">
              {money(totalValue)}
            </div>

            <div className="mt-1 text-xs text-slate-600">
              Across the companies currently represented
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-300">
            {error.message}
          </div>
        )}

        <section className="mt-8 rounded-2xl border border-slate-800 bg-[#071225] p-5 sm:p-7">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">
              Company benchmark
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Ranked by recorded contract value.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-275 text-left text-sm">
              <caption className="sr-only">
                Defence company benchmark
              </caption>

              <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-3">Company</th>
                  <th scope="col" className="px-3 py-3">Type</th>
                  <th scope="col" className="px-3 py-3">Contracts</th>
                  <th scope="col" className="px-3 py-3">Value</th>
                  <th scope="col" className="px-3 py-3">Countries</th>
                  <th scope="col" className="px-3 py-3">Programmes</th>
                  <th scope="col" className="px-3 py-3">Procurement</th>
                  <th scope="col" className="px-3 py-3">History</th>
                </tr>
              </thead>

              <tbody>
                {companies.map((company) => (
                  <tr
                    key={company.company_id}
                    className="border-b border-slate-800/70 last:border-0"
                  >
                    <td className="px-3 py-4">
                      <Link
                        href={`/companies/${company.company_id}`}
                        className="font-semibold text-slate-200 hover:text-cyan-300"
                      >
                        {company.company_name}
                      </Link>

                      {company.headquarters_country && (
                        <div className="mt-1 text-xs text-slate-600">
                          {company.headquarters_country}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-4 text-slate-500">
                      {company.company_type || "—"}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {company.contract_count}
                    </td>

                    <td className="px-3 py-4 font-medium text-white">
                      {money(company.total_contract_value)}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {company.country_count}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {company.programme_count}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {company.procurement_event_count}
                    </td>

                    <td className="px-3 py-4 text-slate-400">
                      {company.intelligence_change_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-[#071225] p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-white">
            Intelligence interpretation
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-[#040c19] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Contract exposure
              </div>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Contract value provides a view of the recorded procurement
                exposure represented in the database.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#040c19] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Market reach
              </div>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Customer-country relationships indicate how broadly a
                company is represented across the current dataset.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#040c19] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Intelligence depth
              </div>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Historical change counts indicate where the platform has
                meaningful source-backed company intelligence.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}