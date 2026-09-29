"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type SpendingRow = {
  year: number;
  amount_usd: number | null;
  constant_amount_usd: number | null;
  percentage_gdp?: number | null;
  percentage_government_spending?: number | null;
  is_estimate?: boolean | null;
  constant_is_estimate?: boolean | null;
};

type GovernmentSpendingRow = {
  year: number;
  total_expenditure_usd: number | null;
  expenditure_gdp_percent: number | null;
  is_estimate?: boolean | null;
};

type GovernmentCategoryRow = {
  year: number;
  category_code: string;
  category_name: string;
  amount_usd: number | null;
  percentage_total_expenditure: number | null;
  percentage_gdp: number | null;
  is_estimate?: boolean | null;
};

type Props = {
  spending: SpendingRow[];
  governmentSpending?: GovernmentSpendingRow[];
  governmentCategories?: GovernmentCategoryRow[];
  countryName: string;
};

type Mode = "nominal" | "real" | "gdp" | "government";

const COFOG_NAMES: Record<string, string> = {
  "01": "General public services",
  "02": "Defence",
  "03": "Public order & safety",
  "04": "Economic affairs",
  "05": "Environmental protection",
  "06": "Housing & community amenities",
  "07": "Health",
  "08": "Recreation, culture & religion",
  "09": "Education",
  "10": "Social protection",
};

const COFOG_ORDER = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
];

function formatBillions(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `$${(value / 1_000_000_000).toFixed(1)}bn`;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(2)}%`;
}

function formatChange(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function getCategoryName(row: GovernmentCategoryRow) {
  return (
    COFOG_NAMES[row.category_code] ||
    row.category_name ||
    row.category_code
  );
}

export default function SpendingChart({
  spending,
  governmentSpending = [],
  governmentCategories = [],
  countryName,
}: Props) {
  const [mode, setMode] = useState<Mode>("nominal");

  const sortedSpending = useMemo(() => {
    return [...spending]
      .filter((row) => Number.isFinite(row.year))
      .sort((a, b) => a.year - b.year);
  }, [spending]);

  const latestSpending = useMemo(() => {
    return sortedSpending.length > 0
      ? sortedSpending[sortedSpending.length - 1]
      : null;
  }, [sortedSpending]);

  const latestGovernment = useMemo(() => {
    return [...governmentSpending]
      .filter((row) => Number.isFinite(row.year))
      .sort((a, b) => b.year - a.year)[0] ?? null;
  }, [governmentSpending]);

  /*
   * Historical chart data.
   */
  const chartData = useMemo(() => {
    return sortedSpending.map((row) => {
      if (mode === "nominal") {
        return {
          year: row.year,
          value: row.amount_usd,
          estimate: Boolean(row.is_estimate),
        };
      }

      if (mode === "real") {
        return {
          year: row.year,
          value: row.constant_amount_usd,
          estimate: Boolean(row.constant_is_estimate),
        };
      }

      if (mode === "gdp") {
        return {
          year: row.year,
          value: row.percentage_gdp ?? null,
          estimate: Boolean(row.is_estimate),
        };
      }

      return {
        year: row.year,
        value: row.percentage_government_spending ?? null,
        estimate: Boolean(row.is_estimate),
      };
    });
  }, [sortedSpending, mode]);

  const latestChartValue =
    chartData.length > 0
      ? chartData[chartData.length - 1].value
      : null;

  const previousChartValue =
    chartData.length > 1
      ? chartData[chartData.length - 2].value
      : null;

  const firstChartValue =
    chartData.length > 0
      ? chartData[0].value
      : null;

  const latestYear =
    chartData.length > 0
      ? chartData[chartData.length - 1].year
      : null;

  const firstYear =
    chartData.length > 0
      ? chartData[0].year
      : null;

  const yoy =
    latestChartValue !== null &&
    previousChartValue !== null &&
    previousChartValue !== 0
      ? ((latestChartValue - previousChartValue) /
          previousChartValue) *
        100
      : null;

  const sinceStart =
    latestChartValue !== null &&
    firstChartValue !== null &&
    firstChartValue !== 0
      ? ((latestChartValue - firstChartValue) /
          firstChartValue) *
        100
      : null;

  const yearsElapsed =
    firstYear !== null && latestYear !== null
      ? latestYear - firstYear
      : 0;

  const cagr =
    firstChartValue !== null &&
    latestChartValue !== null &&
    firstChartValue > 0 &&
    latestChartValue > 0 &&
    yearsElapsed > 0
      ? (Math.pow(
          latestChartValue / firstChartValue,
          1 / yearsElapsed
        ) -
          1) *
        100
      : null;

  /*
   * Latest SIPRI government-spending share.
   *
   * This remains the authoritative defence-share figure.
   * COFOG is used separately for the wider government
   * composition once that data is available.
   */
  const latestMilitaryShare =
    latestSpending?.percentage_government_spending ?? null;

  const latestMilitaryAmount =
    latestSpending?.amount_usd ?? null;

  /*
   * Latest COFOG year.
   */
  const latestCategoryYear = useMemo(() => {
    if (governmentCategories.length === 0) {
      return null;
    }

    return (
      [...governmentCategories]
        .filter((row) => Number.isFinite(row.year))
        .sort((a, b) => b.year - a.year)[0]?.year ?? null
    );
  }, [governmentCategories]);

  /*
   * All COFOG categories for the latest available year.
   */
  const latestCategories = useMemo(() => {
    if (latestCategoryYear === null) {
      return [];
    }

    return governmentCategories
      .filter((row) => row.year === latestCategoryYear)
      .sort((a, b) => {
        const aIndex = COFOG_ORDER.indexOf(a.category_code);
        const bIndex = COFOG_ORDER.indexOf(b.category_code);

        if (aIndex === -1 && bIndex === -1) {
          return getCategoryName(a).localeCompare(
            getCategoryName(b)
          );
        }

        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;

        return aIndex - bIndex;
      });
  }, [governmentCategories, latestCategoryYear]);

  const hasCOFOGData = latestCategories.length > 0;

  /*
   * Prepare the multi-sector government composition.
   */
  const governmentComposition = useMemo(() => {
    return latestCategories
      .map((row) => ({
        code: row.category_code,
        name: getCategoryName(row),
        percentage:
          row.percentage_total_expenditure !== null
            ? Number(row.percentage_total_expenditure)
            : null,
        amount:
          row.amount_usd !== null
            ? Number(row.amount_usd)
            : null,
        estimate: Boolean(row.is_estimate),
      }))
      .filter(
        (row) =>
          row.percentage !== null &&
          Number.isFinite(row.percentage) &&
          row.percentage > 0
      );
  }, [latestCategories]);

  const defenceCategory = governmentComposition.find(
    (row) => row.code === "02"
  );

  /*
   * Fallback composition used before COFOG data is imported.
   *
   * This is deliberately labelled "Other government spending"
   * rather than pretending we know its individual sectors.
   */
  const fallbackMilitaryShare = latestMilitaryShare;

  const fallbackOtherShare =
    fallbackMilitaryShare !== null
      ? Math.max(0, 100 - fallbackMilitaryShare)
      : null;

  /*
   * Government-sector chart colours.
   *
   * These are only used for the Recharts component.
   */
  const pieColors = [
    "#60a5fa",
    "#4ade80",
    "#fbbf24",
    "#f87171",
    "#a78bfa",
    "#22d3ee",
    "#fb7185",
    "#c084fc",
    "#34d399",
    "#facc15",
  ];

  /*
   * Government total from IMF.
   */
  const governmentTotal =
    latestGovernment?.total_expenditure_usd ?? null;

  /*
   * Derived "other" amount is intentionally only displayed
   * in the fallback view. Once COFOG exists, the individual
   * sector amounts are shown instead.
   */
  const fallbackOtherAmount =
    governmentTotal !== null &&
    latestMilitaryAmount !== null
      ? Math.max(
          0,
          governmentTotal - latestMilitaryAmount
        )
      : null;

  return (
    <section className="space-y-6">
      {/* Mode selector */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("nominal")}
          className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
            mode === "nominal"
              ? "border-blue-400 bg-blue-500/10 text-blue-300"
              : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600"
          }`}
        >
          Nominal
        </button>

        <button
          type="button"
          onClick={() => setMode("real")}
          className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
            mode === "real"
              ? "border-blue-400 bg-blue-500/10 text-blue-300"
              : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600"
          }`}
        >
          Real terms
        </button>

        <button
          type="button"
          onClick={() => setMode("gdp")}
          className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
            mode === "gdp"
              ? "border-blue-400 bg-blue-500/10 text-blue-300"
              : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600"
          }`}
        >
          % GDP
        </button>

        <button
          type="button"
          onClick={() => setMode("government")}
          className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
            mode === "government"
              ? "border-blue-400 bg-blue-500/10 text-blue-300"
              : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600"
          }`}
        >
          % Government spending
        </button>
      </div>

      {/* Government spending composition */}
      {mode === "government" && (
        <>
          {hasCOFOGData ? (
            <div className="intel-surface p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold">
                  Government spending composition
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  {countryName}, {latestCategoryYear}
                </p>
              </div>

              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
                {/* Donut */}
                <div className="min-h-100">
                  <ResponsiveContainer
                    width="100%"
                    height={400}
                  >
                    <PieChart>
                      <Pie
                        data={governmentComposition}
                        dataKey="percentage"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        innerRadius={105}
                        outerRadius={155}
                        paddingAngle={1}
                        stroke="#0f172a"
                        strokeWidth={2}
                      >
                        {governmentComposition.map(
                          (entry, index) => (
                            <Cell
                              key={entry.code}
                              fill={
                                pieColors[
                                  index % pieColors.length
                                ]
                              }
                            />
                          )
                        )}
                      </Pie>

                      <Tooltip
                        formatter={(
                          value: unknown,
                          name: unknown
                        ) => [
                          `${Number(value).toFixed(2)}%`,
                          String(name),
                        ]}
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          border:
                            "1px solid #1e293b",
                          borderRadius: "8px",
                          color: "#f8fafc",
                        }}
                      />

                      <Legend
                        verticalAlign="bottom"
                        height={65}
                        formatter={(value) => (
                          <span className="text-xs text-slate-300">
                            {value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Sector list */}
                <div className="flex flex-col justify-center">
                  <div className="mb-6">
                    <div className="text-4xl font-semibold tracking-tight">
                      {defenceCategory
                        ? formatPercent(
                            defenceCategory.percentage
                          )
                        : "—"}
                    </div>

                    <div className="mt-1 text-sm text-slate-400">
                      Defence share of government spending
                    </div>
                  </div>

                  <div className="space-y-2">
                    {governmentComposition.map(
                      (category, index) => (
                        <div
                          key={category.code}
                          className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 px-3 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className="h-3 w-3 shrink-0 rounded-full"
                              style={{
                                background:
                                  pieColors[
                                    index %
                                      pieColors.length
                                  ],
                              }}
                            />

                            <span className="truncate text-sm text-slate-300">
                              {category.name}
                            </span>
                          </div>

                          <span className="shrink-0 text-sm font-medium text-slate-100">
                            {formatPercent(
                              category.percentage
                            )}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm leading-6 text-slate-400">
                <strong className="text-slate-300">
                  Source:
                </strong>{" "}
                IMF Government Finance Statistics —
                Classification of the Functions of Government
                (COFOG). Categories are shown where usable
                observations are available for this country and
                year.
              </div>
            </div>
          ) : (
            <div className="intel-surface p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold">
                  Military spending as a share of government
                  spending
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  {countryName}
                  {latestYear !== null
                    ? `, ${latestYear}`
                    : ""}
                </p>
              </div>

              {fallbackMilitaryShare !== null ? (
                <>
                  <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
                    {/* Fallback donut */}
                    <div className="min-h-100">
                      <ResponsiveContainer
                        width="100%"
                        height={400}
                      >
                        <PieChart>
                          <Pie
                            data={[
                              {
                                name: "Military spending",
                                value: fallbackMilitaryShare,
                              },
                              {
                                name: "Other government spending",
                                value:
                                  fallbackOtherShare ?? 0,
                              },
                            ]}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={105}
                            outerRadius={155}
                            paddingAngle={1}
                            stroke="#0f172a"
                            strokeWidth={2}
                          >
                            <Cell fill="#60a5fa" />
                            <Cell fill="#475569" />
                          </Pie>

                          <Tooltip
                            formatter={(
                              value: unknown,
                              name: unknown
                            ) => [
                              `${Number(value).toFixed(2)}%`,
                              String(name),
                            ]}
                            contentStyle={{
                              backgroundColor:
                                "#0f172a",
                              border:
                                "1px solid #1e293b",
                              borderRadius: "8px",
                              color: "#f8fafc",
                            }}
                          />

                          <Legend
                            verticalAlign="bottom"
                            height={60}
                            formatter={(value) => (
                              <span className="text-xs text-slate-300">
                                {value}
                              </span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Summary */}
                    <div className="flex flex-col justify-center">
                      <div className="mb-6">
                        <div className="text-4xl font-semibold tracking-tight">
                          {formatPercent(
                            fallbackMilitaryShare
                          )}
                        </div>

                        <div className="mt-1 text-sm text-slate-400">
                          of government spending
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                        <div className="rounded-lg border border-slate-800 p-4">
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full bg-blue-400" />

                            <span className="text-sm text-slate-400">
                              Military spending
                            </span>
                          </div>

                          <div className="mt-2 text-2xl font-semibold">
                            {formatPercent(
                              fallbackMilitaryShare
                            )}
                          </div>

                          <div className="mt-1 text-sm text-slate-500">
                            {formatBillions(
                              latestMilitaryAmount
                            )}
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-800 p-4">
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full bg-slate-600" />

                            <span className="text-sm text-slate-400">
                              Other government spending
                            </span>
                          </div>

                          <div className="mt-2 text-2xl font-semibold">
                            {formatPercent(
                              fallbackOtherShare
                            )}
                          </div>

                          <div className="mt-1 text-sm text-slate-500">
                            {formatBillions(
                              fallbackOtherAmount
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm leading-6 text-slate-400">
                    <strong className="text-slate-300">
                      Sector breakdown:
                    </strong>{" "}
                    Individual government sectors will appear
                    here once IMF COFOG data has been imported.
                    Until then, non-defence expenditure is shown
                    as one combined category.
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                  No government-spending share is available for
                  this country and year.
                </div>
              )}

              {latestGovernment && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-800 p-4">
                    <div className="text-sm text-slate-400">
                      Total government expenditure
                    </div>

                    <div className="mt-2 text-2xl font-semibold">
                      {formatBillions(
                        latestGovernment.total_expenditure_usd
                      )}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      IMF WEO
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 p-4">
                    <div className="text-sm text-slate-400">
                      COFOG sector data
                    </div>

                    <div className="mt-2 text-2xl font-semibold">
                      Not yet imported
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Historical spending */}
      {(mode === "nominal" || mode === "real") && (
        <>
          <div className="intel-surface p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold">
                {mode === "real"
                  ? "Military spending — constant 2024 US$"
                  : "Military spending — current US$"}
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                Historical military expenditure for{" "}
                {countryName}.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-sm text-slate-400">
                  Latest
                </div>

                <div className="mt-1 text-2xl font-semibold">
                  {formatBillions(latestChartValue)}
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-400">
                  YoY change
                </div>

                <div className="mt-1 text-2xl font-semibold">
                  {formatChange(yoy)}
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-400">
                  Since start
                </div>

                <div className="mt-1 text-2xl font-semibold">
                  {formatChange(sinceStart)}
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-400">
                  CAGR
                </div>

                <div className="mt-1 text-2xl font-semibold">
                  {formatChange(cagr)}
                </div>
              </div>
            </div>

            <div className="mt-8 h-90">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e293b"
                  />

                  <XAxis
                    dataKey="year"
                    tick={{
                      fill: "#94a3b8",
                      fontSize: 12,
                    }}
                    tickLine={false}
                    axisLine={false}
                  />

                  <YAxis
                    tick={{
                      fill: "#94a3b8",
                      fontSize: 12,
                    }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      `$${(
                        Number(value) /
                        1_000_000_000
                      ).toFixed(0)}bn`
                    }
                  />

                  <Tooltip
                    formatter={(value: unknown) => [
                      formatBillions(
                        value === null ||
                          value === undefined
                          ? null
                          : Number(value)
                      ),
                      mode === "real"
                        ? "Real spending"
                        : "Military spending",
                    ]}
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border:
                        "1px solid #1e293b",
                      borderRadius: "8px",
                      color: "#f8fafc",
                    }}
                  />

                  <Line
                    type="monotone"
                    dataKey="value"
                    name={
                      mode === "real"
                        ? "Real spending"
                        : "Military spending"
                    }
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="intel-surface overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-semibold">
                Historical spending
              </h3>
            </div>

            <div className="table-scroll">
              <table className="w-full min-w-155 text-sm">
                <thead>
                  <tr className="border-t border-slate-800">
                    <th className="px-6 py-3 text-left">
                      Year
                    </th>

                    <th className="px-6 py-3 text-right">
                      Spending
                    </th>

                    <th className="px-6 py-3 text-right">
                      YoY
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {chartData
                    .slice()
                    .reverse()
                    .map((row, index, rows) => {
                      const previous =
                        rows[index + 1]?.value ??
                        null;

                      const change =
                        row.value !== null &&
                        previous !== null &&
                        previous !== 0
                          ? ((row.value - previous) /
                              previous) *
                            100
                          : null;

                      return (
                        <tr
                          key={row.year}
                          className="border-t border-slate-800"
                        >
                          <td className="px-6 py-3">
                            {row.year}
                          </td>

                          <td className="px-6 py-3 text-right font-medium">
                            {formatBillions(
                              row.value
                            )}

                            {row.estimate && (
                              <span className="ml-2 text-xs text-slate-500">
                                est.
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-3 text-right text-slate-400">
                            {formatChange(change)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* GDP burden */}
      {mode === "gdp" && (
        <div className="intel-surface p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold">
              Military spending as a share of GDP
            </h3>

            <p className="mt-1 text-sm text-slate-400">
              Historical defence burden for {countryName}.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-sm text-slate-400">
                Latest
              </div>

              <div className="mt-1 text-2xl font-semibold">
                {formatPercent(latestChartValue)}
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-400">
                YoY change
              </div>

              <div className="mt-1 text-2xl font-semibold">
                {formatChange(yoy)}
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-400">
                Since start
              </div>

              <div className="mt-1 text-2xl font-semibold">
                {formatChange(sinceStart)}
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-400">
                CAGR
              </div>

              <div className="mt-1 text-2xl font-semibold">
                {formatChange(cagr)}
              </div>
            </div>
          </div>

          <div className="mt-8 h-90">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <LineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e293b"
                />

                <XAxis
                  dataKey="year"
                  tick={{
                    fill: "#94a3b8",
                    fontSize: 12,
                  }}
                  tickLine={false}
                  axisLine={false}
                />

                <YAxis
                  tick={{
                    fill: "#94a3b8",
                    fontSize: 12,
                  }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) =>
                    `${Number(value).toFixed(1)}%`
                  }
                />

                <Tooltip
                  formatter={(value: unknown) => [
                    formatPercent(
                      value === null ||
                        value === undefined
                        ? null
                        : Number(value)
                    ),
                    "Military spending",
                  ]}
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border:
                      "1px solid #1e293b",
                    borderRadius: "8px",
                    color: "#f8fafc",
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="value"
                  name="Military spending"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm leading-6 text-slate-400">
            Military expenditure as a percentage of GDP is
            sourced from SIPRI. This measures the relative
            defence burden on the national economy and should
            not be confused with military spending as a share
            of government expenditure.
          </div>
        </div>
      )}

      {/* Methodology */}
      <div className="intel-surface p-6">
        <h3 className="text-lg font-semibold">
          Methodology
        </h3>

        <div className="mt-3 space-y-3 text-sm leading-6 text-slate-400">
          <p>
            Nominal military expenditure uses current US
            dollars from SIPRI. Real-terms expenditure uses
            constant 2024 US dollars.
          </p>

          <p>
            Military expenditure as a share of GDP and as a
            share of government spending uses SIPRI&apos;s reported
            defence-burden measures.
          </p>

          <p>
            Government spending composition uses IMF
            Government Finance Statistics COFOG observations
            where available. COFOG classifies expenditure by
            government function, including defence, health,
            education, social protection and economic affairs.
          </p>

          <p>
            COFOG coverage varies between countries and years.
            The platform does not fabricate missing sector
            observations.
          </p>

          <p>
            IMF government expenditure totals and SIPRI defence
            expenditure measures may use different accounting
            and fiscal-year conventions. They are therefore
            presented with their respective source provenance.
          </p>
        </div>
      </div>
    </section>
  );
}