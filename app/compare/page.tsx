import Link from "next/link";
import { supabase } from "@/lib/supabase/supabase";
import CompareSpendingChart from "@/components/comparespendingchart";

type SearchParams = {
  country?: string | string[];
  countries?: string | string[];
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

type SpendingRecord = {
  country_id: number;
  year: number;
  amount_usd: number | null;
  is_estimate: boolean | null;
  constant_amount_usd: number | null;
  constant_price_year: number | null;
  constant_is_estimate: boolean | null;
};

type EquipmentLink = {
  country_id: number;
  equipment_id: number;
  quantity: number | null;
};

type ProgrammeRecord = {
  id: number;
  country_id: number;
  name: string;
  status: string | null;
  programme_type: string | null;
};

type ContractRecord = {
  id: number;
  country_id: number;
  company_id: number | null;
  title: string;
  value: number | null;
  status: string | null;
  contract_date: string | null;
  programme_id: number | null;
};

function getParamValues(
  value: string | string[] | undefined
): string[] {
  if (!value) return [];

  return Array.isArray(value) ? value : [value];
}

function parseCountryIds(
  searchParams: SearchParams
): number[] {
  const values = [
    ...getParamValues(searchParams.country),
    ...getParamValues(searchParams.countries),
  ];

  const ids = values
    .flatMap((value) => value.split(","))
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  return Array.from(new Set(ids));
}

function formatBillions(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `$${(value / 1_000_000_000).toFixed(1)}bn`;
}

function formatNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("en-US");
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toFixed(1)}%`;
}

function calculateChange(
  current: number | null,
  previous: number | null
) {
  if (
    current === null ||
    previous === null ||
    previous === 0
  ) {
    return null;
  }

  return ((current - previous) / previous) * 100;
}

export default async function ComparePage({
  searchParams,
}: PageProps) {
  const resolvedSearchParams = await searchParams;

  const countryIds = parseCountryIds(
    resolvedSearchParams
  );

  const { data: allCountries } = await supabase
    .from("countries")
    .select("id,name,iso_code,region")
    .order("name");

  const countries = (allCountries ?? []).filter((country) =>
    countryIds.includes(country.id)
  );

  const selectedCountryIds = countries.map(
    (country) => country.id
  );

  let spending: SpendingRecord[] = [];
  let equipmentLinks: EquipmentLink[] = [];
  let programmes: ProgrammeRecord[] = [];
  let contracts: ContractRecord[] = [];

  if (selectedCountryIds.length > 0) {
    const [
      spendingResult,
      equipmentResult,
      programmesResult,
      contractsResult,
    ] = await Promise.all([
      /*
       * IMPORTANT:
       * Include the constant-dollar SIPRI fields here.
       * These power the Real terms view in CompareSpendingChart.
       */
      supabase
        .from("budgets")
        .select(`
          country_id,
          year,
          amount_usd,
          is_estimate,
          constant_amount_usd,
          constant_price_year,
          constant_is_estimate
        `)
        .in("country_id", selectedCountryIds)
        .eq("source_id", 1)
        .order("year", { ascending: true }),

      supabase
        .from("country_equipment")
        .select(
          "country_id,equipment_id,quantity"
        )
        .in("country_id", selectedCountryIds),

      supabase
        .from("programmes")
        .select(
          "id,country_id,name,status,programme_type"
        )
        .in("country_id", selectedCountryIds)
        .order("name"),

      supabase
        .from("contracts")
        .select(
          "id,country_id,title,value,status,contract_date,company_id,programme_id"
        )
        .in("country_id", selectedCountryIds)
        .order("contract_date", {
          ascending: false,
          nullsFirst: false,
        }),
    ]);

    spending = spendingResult.data ?? [];
    equipmentLinks = equipmentResult.data ?? [];
    programmes = programmesResult.data ?? [];
    contracts = contractsResult.data ?? [];

  }

  const spendingByCountry = countries.map((country) => {
    const rows = spending
      .filter(
        (row) =>
          Number(row.country_id) === Number(country.id)
      )
      .sort((a, b) => a.year - b.year);

    const available = rows.filter(
      (row) =>
        row.amount_usd !== null &&
        row.amount_usd !== undefined
    );

    const latest =
      available.length > 0
        ? available[available.length - 1]
        : null;

    const previous =
      available.length > 1
        ? available[available.length - 2]
        : null;

    const latestValue = latest
      ? Number(latest.amount_usd)
      : null;

    const previousValue = previous
      ? Number(previous.amount_usd)
      : null;

    return {
      country,
      latestYear: latest?.year ?? null,
      latestValue,
      previousValue,
      change: calculateChange(
        latestValue,
        previousValue
      ),
    };
  });

  const latestSpendingRanking = [
    ...spendingByCountry,
  ].sort(
    (a, b) =>
      (b.latestValue ?? 0) -
      (a.latestValue ?? 0)
  );

  const equipmentByCountry = countries.map((country) => {
    const links = equipmentLinks.filter(
      (item) =>
        Number(item.country_id) ===
        Number(country.id)
    );

    const quantity = links.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0),
      0
    );

    return {
      country,
      systems: new Set(
        links.map((item) => item.equipment_id)
      ).size,
      quantity,
    };
  });

  const programmesByCountry = countries.map((country) => {
    const countryProgrammes = programmes.filter(
      (programme) =>
        Number(programme.country_id) ===
        Number(country.id)
    );

    return {
      country,
      count: countryProgrammes.length,
      active: countryProgrammes.filter(
        (programme) => {
          const status =
            programme.status?.toLowerCase() || "";

          return (
            status.includes("active") ||
            status.includes("production") ||
            status.includes("development") ||
            status.includes("procurement")
          );
        }
      ).length,
    };
  });

  const contractsByCountry = countries.map((country) => {
    const countryContracts = contracts.filter(
      (contract) =>
        Number(contract.country_id) ===
        Number(country.id)
    );

    const companyCount = new Set(
      countryContracts
        .map((contract) => contract.company_id)
        .filter(Boolean)
    ).size;

    return {
      country,
      count: countryContracts.length,
      companyCount,
    };
  });

  const latestYear =
    spending.length > 0
      ? Math.max(
          ...spending.map((row) => Number(row.year))
        )
      : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <div className="mb-4 text-sm text-slate-500">
          <Link
            href="/"
            className="hover:text-slate-300"
          >
            Overview
          </Link>

          <span className="mx-2">/</span>

          Compare
        </div>

        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
              Analysis
            </p>

            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              Compare countries
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Compare defence spending, equipment,
              programmes and procurement activity across
              selected countries.
            </p>
          </div>

          <Link
            href="/countries"
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:border-slate-600 hover:text-white"
          >
            Browse countries
          </Link>
        </div>
      </header>

      {/* Country selector */}
      <section className="intel-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              Countries
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Select countries from the country profiles
              to build a comparison.
            </p>
          </div>

          <p className="text-sm text-slate-500">
            {countries.length} selected
          </p>
        </div>

        {allCountries && allCountries.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {allCountries.map((country) => {
              const selected =
                countryIds.includes(country.id);

              const nextIds = selected
                ? countryIds.filter(
                    (id) => id !== country.id
                  )
                : [
                    ...countryIds,
                    country.id,
                  ];

              const query =
                nextIds.length > 0
                  ? `?countries=${nextIds.join(",")}`
                  : "";

              return (
                <Link
                  key={country.id}
                  href={`/compare${query}`}
                  className={`rounded-full border px-3 py-2 text-sm transition ${
                    selected
                      ? "border-sky-700 bg-sky-950/50 text-sky-300"
                      : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                  }`}
                >
                  {country.name}
                </Link>
              );
            })}
          </div>
        ) : null}
      </section>

      {/* No selection */}
      {countries.length === 0 ? (
        <section className="intel-surface p-10 text-center">
          <h2 className="text-xl font-semibold">
            Select countries to compare
          </h2>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
            Choose two or more countries above to compare
            defence spending and other recorded defence
            indicators.
          </p>
        </section>
      ) : (
        <>
          {/* Spending comparison */}
          <CompareSpendingChart
            countries={countries.map((country) => ({
              id: country.id,
              name: country.name,
            }))}
            spending={spending.map((row) => ({
              country_id: Number(row.country_id),
              year: Number(row.year),
              amount_usd:
                row.amount_usd != null
                  ? Number(row.amount_usd)
                  : null,
              constant_amount_usd:
                row.constant_amount_usd != null
                  ? Number(row.constant_amount_usd)
                  : null,
              is_estimate:
                row.is_estimate ?? null,
              constant_is_estimate:
                row.constant_is_estimate ?? null,
            }))}
          />

          {/* At a glance */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">
                Comparison at a glance
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Latest recorded indicators across the
                selected countries.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="intel-surface p-5">
                <p className="text-sm text-slate-400">
                  Countries
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {countries.length}
                </p>
              </div>

              <div className="intel-surface p-5">
                <p className="text-sm text-slate-400">
                  Latest spending year
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {latestYear ?? "—"}
                </p>
              </div>

              <div className="intel-surface p-5">
                <p className="text-sm text-slate-400">
                  Equipment systems
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {equipmentLinks.length > 0
                    ? new Set(
                        equipmentLinks.map(
                          (item) =>
                            `${item.country_id}-${item.equipment_id}`
                        )
                      ).size
                    : 0}
                </p>
              </div>

              <div className="intel-surface p-5">
                <p className="text-sm text-slate-400">
                  Programmes
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {programmes.length}
                </p>
              </div>
            </div>
          </section>

          {/* Spending ranking */}
          <section className="intel-surface overflow-hidden">
            <div className="border-b border-slate-800 px-6 py-5">
              <h2 className="text-lg font-semibold">
                Latest spending ranking
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Ranking based on the latest recorded
                nominal military expenditure.
              </p>
            </div>

            <div className="divide-y divide-slate-800">
              {latestSpendingRanking.map(
                (item, index) => (
                  <div
                    key={item.country.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
                  >
                    <div className="flex items-center gap-4">
                      <span className="w-6 text-sm text-slate-500">
                        {index + 1}
                      </span>

                      <div>
                        <Link
                          href={`/countries/${item.country.id}`}
                          className="font-medium hover:text-sky-300"
                        >
                          {item.country.name}
                        </Link>

                        {item.latestYear && (
                          <p className="mt-1 text-xs text-slate-500">
                            {item.latestYear}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold">
                        {formatBillions(
                          item.latestValue
                        )}
                      </p>

                      <p
                        className={`mt-1 text-xs ${
                          item.change !== null &&
                          item.change > 0
                            ? "text-emerald-400"
                            : item.change !== null &&
                              item.change < 0
                            ? "text-red-400"
                            : "text-slate-500"
                        }`}
                      >
                        {formatPercent(
                          item.change
                        )}{" "}
                        YoY
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          </section>

          {/* Equipment */}
          <section className="intel-surface overflow-hidden">
            <div className="border-b border-slate-800 px-6 py-5">
              <h2 className="text-lg font-semibold">
                Equipment comparison
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Recorded equipment relationships and
                quantities.
              </p>
            </div>

            <div className="table-scroll">
              <table className="w-full min-w-175 text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left">
                    <th className="px-6 py-3">
                      Country
                    </th>

                    <th className="px-6 py-3">
                      Systems
                    </th>

                    <th className="px-6 py-3">
                      Recorded quantity
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {equipmentByCountry.map(
                    (item) => (
                      <tr
                        key={item.country.id}
                        className="border-b border-slate-900 last:border-0"
                      >
                        <td className="px-6 py-4 font-medium">
                          <Link
                            href={`/countries/${item.country.id}`}
                            className="hover:text-sky-300"
                          >
                            {item.country.name}
                          </Link>
                        </td>

                        <td className="px-6 py-4">
                          {formatNumber(
                            item.systems
                          )}
                        </td>

                        <td className="px-6 py-4">
                          {item.quantity > 0
                            ? formatNumber(
                                item.quantity
                              )
                            : "Not recorded"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Programmes and procurement */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="intel-surface overflow-hidden">
              <div className="border-b border-slate-800 px-6 py-5">
                <h2 className="text-lg font-semibold">
                  Defence programmes
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Recorded programmes by country.
                </p>
              </div>

              <div className="divide-y divide-slate-800">
                {programmesByCountry.map(
                  (item) => (
                    <div
                      key={item.country.id}
                      className="flex items-center justify-between gap-4 px-6 py-4"
                    >
                      <Link
                        href={`/countries/${item.country.id}`}
                        className="font-medium hover:text-sky-300"
                      >
                        {item.country.name}
                      </Link>

                      <div className="text-right">
                        <p className="font-semibold">
                          {item.count}
                        </p>

                        <p className="text-xs text-slate-500">
                          {item.active} active
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </section>

            <section className="intel-surface overflow-hidden">
              <div className="border-b border-slate-800 px-6 py-5">
                <h2 className="text-lg font-semibold">
                  Procurement activity
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Recorded contracts and connected
                  companies.
                </p>
              </div>

              <div className="divide-y divide-slate-800">
                {contractsByCountry.map(
                  (item) => (
                    <div
                      key={item.country.id}
                      className="flex items-center justify-between gap-4 px-6 py-4"
                    >
                      <Link
                        href={`/countries/${item.country.id}`}
                        className="font-medium hover:text-sky-300"
                      >
                        {item.country.name}
                      </Link>

                      <div className="text-right">
                        <p className="font-semibold">
                          {item.count}{" "}
                          {item.count === 1
                            ? "contract"
                            : "contracts"}
                        </p>

                        <p className="text-xs text-slate-500">
                          {item.companyCount}{" "}
                          connected{" "}
                          {item.companyCount === 1
                            ? "company"
                            : "companies"}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </section>
          </div>

          {/* Country profiles */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">
                Country profiles
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Open an individual country profile for
                the underlying records and sources.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {countries.map((country) => {
                const spendingStats =
                  spendingByCountry.find(
                    (item) =>
                      item.country.id ===
                      country.id
                  );

                const equipmentStats =
                  equipmentByCountry.find(
                    (item) =>
                      item.country.id ===
                      country.id
                  );

                const programmeStats =
                  programmesByCountry.find(
                    (item) =>
                      item.country.id ===
                      country.id
                  );

                const contractStats =
                  contractsByCountry.find(
                    (item) =>
                      item.country.id ===
                      country.id
                  );

                return (
                  <Link
                    key={country.id}
                    href={`/countries/${country.id}`}
                    className="intel-surface block p-6 transition hover:border-sky-800"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold">
                          {country.name}
                        </h3>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {country.iso_code && (
                            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-400">
                              {country.iso_code}
                            </span>
                          )}

                          {country.region && (
                            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-400">
                              {country.region}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="text-sm text-sky-400">
                        View profile →
                      </span>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500">
                          Spending
                        </p>

                        <p className="mt-1 font-semibold">
                          {formatBillions(
                            spendingStats?.latestValue ??
                              null
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          YoY
                        </p>

                        <p className="mt-1 font-semibold">
                          {formatPercent(
                            spendingStats?.change ??
                              null
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Equipment
                        </p>

                        <p className="mt-1 font-semibold">
                          {equipmentStats?.systems ??
                            0}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Programmes
                        </p>

                        <p className="mt-1 font-semibold">
                          {programmeStats?.count ??
                            0}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Contracts
                        </p>

                        <p className="mt-1 font-semibold">
                          {contractStats?.count ??
                            0}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">
                          Companies
                        </p>

                        <p className="mt-1 font-semibold">
                          {contractStats?.companyCount ??
                            0}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Methodology */}
          <details className="intel-surface p-6">
            <summary className="text-sm font-semibold">
              Methodology
            </summary>

            <div className="mt-4 max-w-4xl space-y-3 text-sm leading-6 text-slate-400">
              <p>
                Spending data is sourced from the
                platform&apos;s recorded SIPRI military
                expenditure data.
              </p>

              <p>
                Nominal figures use current US$ at
                current prices and exchange rates.
              </p>

              <p>
                Real-terms figures use constant 2024
                US$, providing a more appropriate basis
                for analysing spending changes over
                time.
              </p>

              <p>
                Missing spending observations are
                treated as missing data rather than
                zero expenditure.
              </p>

              <p>
                Equipment counts represent recorded
                country-equipment relationships.
                Recorded quantities should not
                automatically be interpreted as
                operationally available equipment.
              </p>

              <p>
                Contract counts represent contracts
                recorded against each country. Contract
                values are not summed across countries
                because the platform may contain values
                denominated in different currencies.
              </p>

              <p>
                The comparison is intended to support
                strategic research and analysis and
                should be interpreted alongside the
                underlying sources and confidence
                information.
              </p>
            </div>
          </details>
        </>
      )}
    </div>
  );
}