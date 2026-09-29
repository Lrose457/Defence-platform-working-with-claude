"use client";

import { useMemo, useState } from "react";
import SpendingChart from "./SpendingChart";

type SpendingPoint = {
  year: number;
  amount_usd: number;
  constant_amount_usd?: number | null;
  is_estimate?: boolean | null;
};

type Props = {
  data: SpendingPoint[];
};

function formatBillions(value: number) {
  return `$${(value / 1_000_000_000).toFixed(1)}B`;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function calculateCagr(
  firstValue: number,
  lastValue: number,
  years: number
) {
  if (
    firstValue <= 0 ||
    lastValue <= 0 ||
    years <= 0
  ) {
    return null;
  }

  return (
    (Math.pow(lastValue / firstValue, 1 / years) - 1) *
    100
  );
}

export default function SpendingAnalytics({
  data,
}: Props) {
  const [range, setRange] = useState<"10" | "25">("25");

  const sorted = useMemo(
    () =>
      [...data]
        .filter(
          (item) =>
            Number.isFinite(item.year) &&
            Number.isFinite(Number(item.amount_usd))
        )
        .sort((a, b) => a.year - b.year),
    [data]
  );

  const visibleData = useMemo(() => {
    if (range === "10") {
      return sorted.slice(-10);
    }

    return sorted.slice(-25);
  }, [sorted, range]);

  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  const first = sorted[0];

  const latestChange =
    latest && previous && previous.amount_usd !== 0
      ? ((latest.amount_usd - previous.amount_usd) /
          previous.amount_usd) *
        100
      : null;

  const longTermChange =
    latest && first && first.amount_usd !== 0
      ? ((latest.amount_usd - first.amount_usd) /
          first.amount_usd) *
        100
      : null;

  const cagr =
    latest && first
      ? calculateCagr(
          first.amount_usd,
          latest.amount_usd,
          latest.year - first.year
        )
      : null;

  const peak = sorted.reduce<SpendingPoint | null>(
    (highest, item) => {
      if (!highest || item.amount_usd > highest.amount_usd) {
        return item;
      }

      return highest;
    },
    null
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-xl font-semibold">
          Defence Spending
        </h2>

        <p className="mt-3 text-sm text-slate-400">
          No spending data is currently recorded for this
          country.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics summary */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">
            Latest spending
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {formatBillions(latest.amount_usd)}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {latest.year}
            {latest.is_estimate ? " · SIPRI estimate" : ""}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">
            Year-on-year
          </p>

          <p
            className={`mt-2 text-2xl font-semibold ${
              latestChange !== null && latestChange > 0
                ? "text-green-400"
                : latestChange !== null &&
                    latestChange < 0
                  ? "text-red-400"
                  : ""
            }`}
          >
            {formatPercent(latestChange)}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Compared with {previous?.year || "previous year"}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">
            Change since {first.year}
          </p>

          <p
            className={`mt-2 text-2xl font-semibold ${
              longTermChange !== null &&
              longTermChange > 0
                ? "text-green-400"
                : longTermChange !== null &&
                    longTermChange < 0
                  ? "text-red-400"
                  : ""
            }`}
          >
            {formatPercent(longTermChange)}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Through {latest.year}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">
            CAGR
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {formatPercent(cagr)}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {first.year}–{latest.year}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">
            Peak recorded
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {peak ? formatBillions(peak.amount_usd) : "—"}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {peak?.year || "Not available"}
          </p>
        </div>
      </div>

      {/* Chart */}

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-xl font-semibold">
              Spending history
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Military expenditure recorded by SIPRI in
              current US dollars.
            </p>
          </div>

          <div
            className="flex rounded-lg border border-slate-700 p-1"
            aria-label="Spending history range"
          >
            <button
              type="button"
              onClick={() => setRange("10")}
              aria-pressed={range === "10"}
              className={`rounded-md px-4 py-2 text-sm ${
                range === "10"
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              10 years
            </button>

            <button
              type="button"
              onClick={() => setRange("25")}
              aria-pressed={range === "25"}
              className={`rounded-md px-4 py-2 text-sm ${
                range === "25"
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              25 years
            </button>
          </div>
        </div>

                <SpendingChart
          spending={visibleData.map((item) => ({
            ...item,
            constant_amount_usd: item.constant_amount_usd ?? null,
          }))}
          countryName="Selected countries"
        />

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="pb-3 pr-6">
                  Year
                </th>

                <th className="pb-3 pr-6">
                  Spending
                </th>

                <th className="pb-3 pr-6">
                  Annual change
                </th>

                <th className="pb-3">
                  Data
                </th>
              </tr>
            </thead>

            <tbody>
              {visibleData.map((item, index) => {
                const previousItem =
                  visibleData[index - 1];

                const change =
                  previousItem &&
                  previousItem.amount_usd !== 0
                    ? ((item.amount_usd -
                        previousItem.amount_usd) /
                        previousItem.amount_usd) *
                      100
                    : null;

                return (
                  <tr
                    key={item.year}
                    className="border-b border-slate-800 last:border-0"
                  >
                    <td className="py-3 pr-6">
                      {item.year}
                    </td>

                    <td className="py-3 pr-6 font-medium">
                      {formatBillions(item.amount_usd)}
                    </td>

                    <td className="py-3 pr-6">
                      <span
                        className={
                          change !== null &&
                          change > 0
                            ? "text-green-400"
                            : change !== null &&
                                change < 0
                              ? "text-red-400"
                              : "text-slate-500"
                        }
                      >
                        {formatPercent(change)}
                      </span>
                    </td>

                    <td className="py-3">
                      {item.is_estimate ? (
                        <span className="text-amber-400">
                          Estimate
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          Recorded
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950 p-4">
          <p className="text-xs leading-5 text-slate-500">
            SIPRI updates its military expenditure database
            annually and may revise historical figures when
            new information becomes available. Current-dollar
            figures are useful for comparing countries in a
            given year; trend analysis should be interpreted
            carefully because exchange rates and inflation
            affect current-dollar series.
          </p>
        </div>
      </div>
    </div>
  );
}