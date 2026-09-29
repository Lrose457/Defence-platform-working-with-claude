import { promises as fs } from "fs";
import * as XLSX from "@keep-lts/xlsx";

const DATASET_ROOT = "/Users/leorosenthal/Desktop/Datasets";

const DEFENCE_DATASET_PATH = `${DATASET_ROOT}/final-defence-data-2025-1.xlsx`;
const UKRAINE_TRACKER_PATH = `${DATASET_ROOT}/Kiel institute ukraine support tracker .xlsx`;

const REGIONAL_DATASET_PATHS = [
  `${DATASET_ROOT}/Africa_aggregated_data_up_to_week_of-2026-09-05.xlsx`,
  `${DATASET_ROOT}/Asia-Pacific_aggregated_data_up_to_week_of-2026-09-05.xlsx`,
  `${DATASET_ROOT}/Europe-Central-Asia_aggregated_data_up_to_week_of-2026-09-05.xlsx`,
  `${DATASET_ROOT}/Latin-America-the-Caribbean_aggregated_data_up_to_week_of-2026-09-05.xlsx`,
  `${DATASET_ROOT}/Middle-East_aggregated_data_up_to_week_of-2026-09-05.xlsx`,
  `${DATASET_ROOT}/US-and-Canada_aggregated_data_up_to_week_of-2026-09-05.xlsx`,
];

function normalizeCountryName(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .trim();
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatShortMoney(value: number): string {
  if (!Number.isFinite(value)) {
    return "Not available";
  }

  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}bn`;
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}m`;
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}k`;
  }

  return `$${value.toLocaleString()}`;
}

export type CountryDefenceSnapshot = {
  year: number;
  valueUsdMillions: number;
  source: string;
  label: string;
};

export type SupplementalDatasetEntry = {
  name: string;
  label: string;
  value: string;
  note?: string;
  source: string;
};

export type DatasetCoverageItem = {
  name: string;
  status: string;
  source: string;
};

export async function getDatasetCoverageStatus(): Promise<DatasetCoverageItem[]> {
  const coverage: DatasetCoverageItem[] = [];

  const paths = [
    { name: "Defence dataset", path: DEFENCE_DATASET_PATH },
    { name: "Ukraine support tracker", path: UKRAINE_TRACKER_PATH },
    ...REGIONAL_DATASET_PATHS.map((path) => ({
      name: path.split("/").pop() || path,
      path,
    })),
  ];

  for (const entry of paths) {
    try {
      const buffer = await fs.readFile(entry.path);
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      if (!sheet) {
        coverage.push({
          name: entry.name,
          status: "Unavailable",
          source: entry.path,
        });
        continue;
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: null,
        raw: false,
      });

      const nonEmptyRows = rows.filter((row) =>
        Object.values(row).some(
          (cell) =>
            cell !== null &&
            cell !== undefined &&
            String(cell).trim() !== "",
        ),
      );

      coverage.push({
        name: entry.name,
        status:
          nonEmptyRows.length > 1
            ? `Usable data (${nonEmptyRows.length} rows)`
            : "Header-only / no usable rows",
        source: entry.path,
      });
    } catch {
      coverage.push({
        name: entry.name,
        status: "Unavailable",
        source: entry.path,
      });
    }
  }

  return coverage;
}

export async function getCountryDefenceSnapshot(
  countryName: string | null | undefined,
): Promise<CountryDefenceSnapshot | null> {
  if (!countryName) {
    return null;
  }

  try {
    const buffer = await fs.readFile(DEFENCE_DATASET_PATH);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets["Billions"];

    if (!sheet) {
      return null;
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      raw: true,
    });

    const targetKey = normalizeCountryName(countryName);

    const matched = rows
      .filter((row) => {
        const name = typeof row.PMS === "string" ? row.PMS : "";
        return normalizeCountryName(name) === targetKey;
      })
      .sort((a, b) => Number(b.Year ?? 0) - Number(a.Year ?? 0));

    const latest = matched[0];

    if (
      !latest ||
      latest.Year == null ||
      latest["Total Defence Expenditure "] == null
    ) {
      return null;
    }

    const year = Number(latest.Year);
    const valueUsdMillions = Number(latest["Total Defence Expenditure "]);

    if (!Number.isFinite(year) || !Number.isFinite(valueUsdMillions)) {
      return null;
    }

    return {
      year,
      valueUsdMillions,
      source: "Defence dataset workbook",
      label: "Latest defence expenditure",
    };
  } catch {
    return null;
  }
}

export async function getUkraineSupportTrackerSummary(): Promise<SupplementalDatasetEntry | null> {
  try {
    const buffer = await fs.readFile(UKRAINE_TRACKER_PATH);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets["Bilateral Assistance, MAIN DATA"];

    if (!sheet) {
      return null;
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      raw: false,
    });

    if (!rows.length) {
      return null;
    }

    const numericValues = rows
      .map((row) => parseNumber(row["source_reported_value"]))
      .filter((value): value is number => value !== null);

    if (!numericValues.length) {
      return null;
    }

    const totalTrackedValue = numericValues.reduce(
      (sum, value) => sum + value,
      0,
    );

    const donorCount = new Set(
      rows
        .map((row) => row.donor)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    ).size;

    return {
      name: "Ukraine support tracker",
      label: "Tracked aid",
      value: formatShortMoney(totalTrackedValue),
      note: `${donorCount} donors across ${rows.length} records`,
      source: "Kiel Institute",
    };
  } catch {
    return null;
  }
}

export async function getSupplementalDatasetEntries(
  countryName: string | null | undefined,
): Promise<SupplementalDatasetEntry[]> {
  const entries: SupplementalDatasetEntry[] = [];

  const defenceSnapshot = await getCountryDefenceSnapshot(countryName);
  if (defenceSnapshot) {
    entries.push({
      name: "Defence dataset",
      label: defenceSnapshot.label,
      value: `$${(defenceSnapshot.valueUsdMillions / 1000).toFixed(1)}bn`,
      note: `Reference year ${defenceSnapshot.year}`,
      source: defenceSnapshot.source,
    });
  }

  if (
    countryName &&
    normalizeCountryName(countryName) === normalizeCountryName("Ukraine")
  ) {
    const ukraineSummary = await getUkraineSupportTrackerSummary();
    if (ukraineSummary) {
      entries.push(ukraineSummary);
    }
  }

  return entries;
}
