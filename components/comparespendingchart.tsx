"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Country = {
  id: number;
  name: string;
};

type SpendingRow = {
  country_id: number;
  year: number;
  amount_usd: number | null;
  constant_amount_usd: number | null;
  is_estimate?: boolean | null;
  constant_is_estimate?: boolean | null;
};

type Props = {
  countries: Country[];
  spending: SpendingRow[];
};

type Mode = "nominal" | "real";
type Period = "10" | "all";

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

  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toFixed(1)}%`;
}

function calculateCagr(
  first: number | null,
  last: number | null,
  years: number
) {
  if (
    first === null ||
    last === null ||
    first <= 0 ||
    last <= 0 ||
    years <= 0
  ) {
    return null;
  }

  return (
    (Math.pow(last / first, 1 / years) - 1) * 100
  );
}

export default function CompareSpendingChart({
  countries,
  spending,
}: Props) {
  const [mode, setMode] = useState<Mode>("nominal");
  const [period, setPeriod] = useState<Period>("10");

  const latestYear =
    spending.length > 0
      ? Math.max(
          ...spending.map((row) => Number(row.year))
        )
      : 2025;

  const startYear =
    period === "10"
      ? Math.max(latestYear - 9, 2000)
      : 2000;

  const visibleSpending = spending.filter(
    (row) =>
      Number(row.year) >= startYear &&
      Number(row.year) <= latestYear
  );

  const getValue = (row: SpendingRow) => {
    const value =
      mode === "real"
        ? row.constant_amount_usd
        : row.amount_usd;

    return value === null ||
      value === undefined ||
      !Number.isFinite(Number(value))
      ? null
      : Number(value);
  };

  const countryColors = [
    "var(--accent)",
    "#a78bfa",
    "#34d399",
    "#fbbf24",
    "#f87171",
    "#22d3ee",
    "#fb7185",
    "#c084fc",
  ];

  const chartRows = Array.from(
    {
      length: latestYear - startYear + 1,
    },
    (_, index) => {
      const year = startYear + index;

      const row: Record<string, number | null> = {
        year,
      };

      for (const country of countries) {
        const record = visibleSpending.find(
          (item) =>
            Number(item.country_id) === Number(country.id) &&
            Number(item.year) === year
        );

        row[`country_${country.id}`] = record
          ? getValue(record)
          : null;
      }

      return row;
    }
  );

  const countryStats = countries.map((country) => {
    const rows = visibleSpending
      .filter(
        (row) =>
          Number(row.country_id) === Number(country.id)
      )
      .sort((a, b) => a.year - b.year);

    const available = rows.filter(
      (row) => getValue(row) !== null
    );

    const latest =
      available.length > 0
        ? available[available.length - 1]
        : null;

    const previous =
      available.length > 1
        ? available[available.length - 2]
        : null;

    const first =
      available.length > 0
        ? available[0]
        : null;

    const latestValue = latest
      ? getValue(latest)
      : null;

    const previousValue = previous
      ? getValue(previous)
      : null;

    const firstValue = first
      ? getValue(first)
      : null;

    const yoy =
      latestValue !== null &&
      previousValue !== null &&
      previousValue !== 0
        ? ((latestValue - previousValue) /
            previousValue) *
          100
        : null;

    const sinceStart =
      latestValue !== null &&
      firstValue !== null &&
      firstValue !== 0
        ? ((latestValue - firstValue) /
            firstValue) *
          100
        : null;

    const cagr =
      latest &&
      first &&
      latestValue !== null &&
      firstValue !== null
        ? calculateCagr(
            firstValue,
            latestValue,
            Number(latest.year) - Number(first.year)
          )
        : null;

    return {
      country,
      latest,
      latestValue,
      yoy,
      sinceStart,
      cagr,
      first,
    };
  });

  const ranked = [...countryStats].sort(
    (a, b) =>
      (b.latestValue ?? 0) -
      (a.latestValue ?? 0)
  );

  return (
    <section className="intel-surface overflow-hidden">
      {/* Header */}
      <div className="border-b border-(--border) px-6 py-5">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--accent)">
              Spending comparison
            </p>

            <h2 className="mt-2 text-xl font-semibold">
              Military expenditure
            </h2>

            <p className="mt-1 max-w-3xl text-sm text-(--foreground-muted)">
              Compare defence spending across the selected
              countries in nominal US$ or constant 2024 US$.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Measurement */}
            <div className="flex rounded-lg border border-(--border) bg-(--background) p-1">
              <button
                type="button"
                onClick={() => setMode("nominal")}
                aria-pressed={mode === "nominal"}
                className={`rounded-md px-3 py-2 text-sm ${
                  mode === "nominal"
                    ? "bg-(--surface-hover) text-(--foreground)"
                    : "text-(--foreground-muted)"
                }`}
              >
                Nominal
              </button>

              <button
                type="button"
                onClick={() => setMode("real")}
                aria-pressed={mode === "real"}
                className={`rounded-md px-3 py-2 text-sm ${
                  mode === "real"
                    ? "bg-(--surface-hover) text-(--foreground)"
                    : "text-(--foreground-muted)"
                }`}
              >
                Real terms
              </button>
            </div>

            {/* Period */}
            <div className="flex rounded-lg border border-(--border) bg-(--background) p-1">
              <button
                type="button"
                onClick={() => setPeriod("10")}
                aria-pressed={period === "10"}
                className={`rounded-md px-3 py-2 text-sm ${
                  period === "10"
                    ? "bg-(--surface-hover) text-(--foreground)"
                    : "text-(--foreground-muted)"
                }`}
              >
                10 years
              </button>

              <button
                type="button"
                onClick={() => setPeriod("all")}
                aria-pressed={period === "all"}
                className={`rounded-md px-3 py-2 text-sm ${
                  period === "all"
                    ? "bg-(--surface-hover) text-(--foreground)"
                    : "text-(--foreground-muted)"
                }`}
              >
                2000–2025
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 border-b border-(--border) p-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-(--foreground-subtle)">
            Countries compared
          </p>

          <p className="mt-1 text-2xl font-semibold">
            {countries.length}
          </p>
        </div>

        <div>
          <p className="text-xs text-(--foreground-subtle)">
            Latest year
          </p>

          <p className="mt-1 text-2xl font-semibold">
            {latestYear}
          </p>
        </div>

        <div>
          <p className="text-xs text-(--foreground-subtle)">
            Measurement
          </p>

          <p className="mt-1 text-2xl font-semibold">
            {mode === "real" ? "Real" : "Nominal"}
          </p>

          <p className="mt-1 text-xs text-(--foreground-subtle)">
            {mode === "real"
              ? "Constant 2024 US$"
              : "Current US$"}
          </p>
        </div>

        <div>
          <p className="text-xs text-(--foreground-subtle)">
            Period
          </p>

          <p className="mt-1 text-2xl font-semibold">
            {startYear}–{latestYear}
          </p>
        </div>
      </div>

      {countries.length > 0 ? (
        <>
          {/* Chart */}
          <div className="px-4 pb-2 pt-6 sm:px-6">
            <div className="h-95 w-full">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart
                  data={chartRows}
                  margin={{
                    top: 10,
                    right: 20,
                    left: 10,
                    bottom: 10,
                  }}
                >
                  <CartesianGrid
                    stroke="rgba(148,163,184,0.12)"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="year"
                    stroke="#64748b"
                    tick={{
                      fill: "#94a3b8",
                      fontSize: 12,
                    }}
                    tickLine={false}
                    axisLine={false}
                  />

                  <YAxis
                    stroke="#64748b"
                    tick={{
                      fill: "#94a3b8",
                      fontSize: 12,
                    }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      `$${(
                        Number(value) / 1_000_000_000
                      ).toFixed(0)}bn`
                    }
                  />

                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: "8px",
                      color: "#f8fafc",
                    }}
                    labelStyle={{
                      color: "#94a3b8",
                    }}
                    formatter={(
                      value: unknown,
                      name: unknown
                    ) => {
                      const numericValue =
                        value === null ||
                        value === undefined
                          ? null
                          : Number(value);

                      return [
                        formatBillions(
                          numericValue
                        ),
                        String(name || "Country"),
                      ];
                    }}
                  />

                  {countries.map(
                    (country, index) => (
                      <Line
                        key={country.id}
                        type="monotone"
                        dataKey={`country_${country.id}`}
                        name={country.name}
                        connectNulls={false}
                        stroke={
                          countryColors[
                            index %
                              countryColors.length
                          ]
                        }
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{
                          r: 5,
                        }}
                      />
                    )
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparison */}
          <div className="border-t border-(--border) px-6 py-5">
            <h3 className="text-base font-semibold">
              Comparison
            </h3>

            <p className="mt-1 text-sm text-(--foreground-muted)">
              Latest recorded spending and growth over the
              selected period.
            </p>

            <div className="table-scroll mt-5">
              <table className="w-full min-w-225">
                <thead>
                  <tr className="border-b border-(--border) text-left text-xs uppercase tracking-[0.12em]">
                    <th className="pb-3 pr-6">
                      Country
                    </th>

                    <th className="pb-3 pr-6">
                      Latest
                    </th>

                    <th className="pb-3 pr-6">
                      YoY
                    </th>

                    <th className="pb-3 pr-6">
                      Since start
                    </th>

                    <th className="pb-3">
                      Annual growth
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {ranked.map((item) => (
                    <tr
                      key={item.country.id}
                      className="border-b border-(--border-subtle) last:border-0"
                    >
                      <td className="py-4 pr-6 font-medium">
                        {item.country.name}
                      </td>

                      <td className="py-4 pr-6">
                        {formatBillions(
                          item.latestValue
                        )}
                      </td>

                      <td
                        className={`py-4 pr-6 ${
                          item.yoy !== null &&
                          item.yoy > 0
                            ? "text-(--positive)"
                            : item.yoy !== null &&
                              item.yoy < 0
                            ? "text-(--negative)"
                            : "text-(--foreground-muted)"
                        }`}
                      >
                        {formatPercent(item.yoy)}
                      </td>

                      <td
                        className={`py-4 pr-6 ${
                          item.sinceStart !== null &&
                          item.sinceStart > 0
                            ? "text-(--positive)"
                            : item.sinceStart !== null &&
                              item.sinceStart < 0
                            ? "text-(--negative)"
                            : "text-(--foreground-muted)"
                        }`}
                      >
                        {formatPercent(
                          item.sinceStart
                        )}
                      </td>

                      <td className="py-4">
                        {formatPercent(
                          item.cagr
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ranking */}
          <div className="border-t border-(--border) px-6 py-5">
            <h3 className="text-base font-semibold">
              Latest spending ranking
            </h3>

            <div className="mt-4 space-y-3">
              {ranked.map((item, index) => (
                <div
                  key={item.country.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-(--border) bg-(--background) px-4 py-3"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-6 text-sm text-(--foreground-subtle)">
                      {index + 1}
                    </span>

                    <span className="font-medium">
                      {item.country.name}
                    </span>
                  </div>

                  <span className="font-semibold">
                    {formatBillions(
                      item.latestValue
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="px-6 py-16 text-center">
          <p className="text-sm text-(--foreground-muted)">
            Select at least one country to compare spending.
          </p>
        </div>
      )}

      {/* Methodology */}
      <details className="border-t border-(--border) px-6 py-5">
        <summary className="text-sm font-medium">
          Methodology
        </summary>

        <div className="mt-4 max-w-4xl space-y-3 text-sm leading-6 text-(--foreground-muted)">
          <p>
            Nominal figures use SIPRI military expenditure in
            current US$, at current prices and exchange rates.
          </p>

          <p>
            Real-terms figures use constant 2024 US$, keeping
            prices and exchange rates fixed to the 2024 basis.
          </p>

          <p>
            Nominal US$ is useful for comparing countries in a
            particular year. Constant-dollar figures are more
            appropriate for assessing changes over time.
          </p>

          <p>
            Growth calculations use the first and last available
            observations in the selected period. Missing years
            are treated as missing observations rather than zero.
          </p>

          <p>
            Contract values are deliberately excluded from this
            spending comparison because the platform contains
            contracts in different currencies and those values
            should not be summed without an appropriate
            conversion methodology.
          </p>
        </div>
      </details>
    </section>
  );
}