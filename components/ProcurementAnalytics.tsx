type CountryRow = {
  country_id: number;
  country_name: string;
  event_count: number | string;
  contract_count: number | string;
  high_importance_count: number | string;
  latest_event_date: string | null;
};

type CompanyRow = {
  company_id: number;
  company_name: string;
  event_count: number | string;
  contract_count: number | string;
  high_importance_count: number | string;
  latest_event_date: string | null;
};

type YearRow = {
  year: number;
  event_count: number | string;
  contract_count: number | string;
  high_importance_count: number | string;
  countries_involved: number | string;
  companies_involved: number | string;
  programmes_involved: number | string;
};

type Props = {
  totalEvents: number;
  contractEvents: number;
  highImportanceEvents: number;
  countriesInvolved: number;
  companiesInvolved: number;
  countries: CountryRow[];
  companies: CompanyRow[];
  years: YearRow[];
};

function value(input: number | string | null | undefined) {
  const result = Number(input ?? 0);
  return Number.isFinite(result) ? result : 0;
}

export default function ProcurementAnalytics({
  totalEvents,
  contractEvents,
  highImportanceEvents,
  countriesInvolved,
  companiesInvolved,
  countries,
  companies,
  years,
}: Props) {
  return (
    <div className="space-y-6">
      <section
        aria-label="Procurement metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        {[
          ["Total events", totalEvents, "text-white"],
          ["Contracts", contractEvents, "text-cyan-300"],
          ["High importance", highImportanceEvents, "text-amber-300"],
          ["Countries", countriesInvolved, "text-white"],
          ["Companies", companiesInvolved, "text-white"],
        ].map(([label, metric, colour]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-slate-800 bg-[#071225] p-5"
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              {label}
            </div>

            <div className={`mt-3 text-3xl font-semibold ${colour}`}>
              {value(metric as number)}
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#071225]">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="font-semibold text-white">
              Procurement by country
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">
                Procurement activity by country
              </caption>

              <thead className="bg-[#09172b]">
                <tr>
                  <th
                    scope="col"
                    className="px-5 py-3 text-xs uppercase tracking-wider text-slate-600"
                  >
                    Country
                  </th>

                  <th
                    scope="col"
                    className="px-5 py-3 text-xs uppercase tracking-wider text-slate-600"
                  >
                    Events
                  </th>

                  <th
                    scope="col"
                    className="px-5 py-3 text-xs uppercase tracking-wider text-slate-600"
                  >
                    High
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {countries.slice(0, 15).map((row) => (
                  <tr
                    key={row.country_id}
                    className="hover:bg-[#0a182d]"
                  >
                    <td className="px-5 py-4 font-medium text-slate-200">
                      {row.country_name}
                    </td>

                    <td className="px-5 py-4 text-slate-400">
                      {value(row.event_count)}
                    </td>

                    <td className="px-5 py-4 text-amber-300">
                      {value(row.high_importance_count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#071225]">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="font-semibold text-white">
              Procurement by company
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">
                Procurement activity by company
              </caption>

              <thead className="bg-[#09172b]">
                <tr>
                  <th
                    scope="col"
                    className="px-5 py-3 text-xs uppercase tracking-wider text-slate-600"
                  >
                    Company
                  </th>

                  <th
                    scope="col"
                    className="px-5 py-3 text-xs uppercase tracking-wider text-slate-600"
                  >
                    Events
                  </th>

                  <th
                    scope="col"
                    className="px-5 py-3 text-xs uppercase tracking-wider text-slate-600"
                  >
                    High
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {companies.slice(0, 15).map((row) => (
                  <tr
                    key={row.company_id}
                    className="hover:bg-[#0a182d]"
                  >
                    <td className="px-5 py-4 font-medium text-slate-200">
                      {row.company_name}
                    </td>

                    <td className="px-5 py-4 text-slate-400">
                      {value(row.event_count)}
                    </td>

                    <td className="px-5 py-4 text-amber-300">
                      {value(row.high_importance_count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#071225]">
        <div className="border-b border-slate-800 px-5 py-4">
          <h2 className="font-semibold text-white">
            Procurement activity by year
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">
              Procurement events by year
            </caption>

            <thead className="bg-[#09172b]">
              <tr>
                <th scope="col" className="px-5 py-3 text-xs uppercase tracking-wider text-slate-600">
                  Year
                </th>
                <th scope="col" className="px-5 py-3 text-xs uppercase tracking-wider text-slate-600">
                  Events
                </th>
                <th scope="col" className="px-5 py-3 text-xs uppercase tracking-wider text-slate-600">
                  Contracts
                </th>
                <th scope="col" className="px-5 py-3 text-xs uppercase tracking-wider text-slate-600">
                  High importance
                </th>
                <th scope="col" className="px-5 py-3 text-xs uppercase tracking-wider text-slate-600">
                  Countries
                </th>
                <th scope="col" className="px-5 py-3 text-xs uppercase tracking-wider text-slate-600">
                  Companies
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {years.map((row) => (
                <tr
                  key={row.year}
                  className="hover:bg-[#0a182d]"
                >
                  <td className="px-5 py-4 font-semibold text-white">
                    {row.year}
                  </td>

                  <td className="px-5 py-4 text-slate-400">
                    {value(row.event_count)}
                  </td>

                  <td className="px-5 py-4 text-cyan-300">
                    {value(row.contract_count)}
                  </td>

                  <td className="px-5 py-4 text-amber-300">
                    {value(row.high_importance_count)}
                  </td>

                  <td className="px-5 py-4 text-slate-400">
                    {value(row.countries_involved)}
                  </td>

                  <td className="px-5 py-4 text-slate-400">
                    {value(row.companies_involved)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}