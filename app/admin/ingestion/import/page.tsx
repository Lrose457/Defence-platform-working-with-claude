"use client";

import { ChangeEvent, useMemo, useState } from "react";
import * as XLSX from "@keep-lts/xlsx";
import { csrfFetch } from "@/lib/security/csrfClient";

const MAX_IMPORT_ROWS = 500000;
const CHUNK_SIZE = 25000;

type Row = Record<string, unknown>;

type DatasetType =
  | "countries"
  | "sources"
  | "sipri_milex"
  | "imf_government_expenditure"
  | "budgets"
  | "government_spending"
  | "equipment"
  | "equipment_categories"
  | "country_equipment"
  | "companies"
  | "programmes"
  | "contracts"
  | "contract_equipment"
  | "programme_equipment"
  | "procurement_events"
  | "conflicts"
  | "conflict_parties"
  | "conflict_incidents"
  | "conflict_events"
  | "ukraine_support"
  | "training_exercises"
  | "carrier_air_wings"
  | "carrier_air_wing_aircraft"
  | "ai_defence_projects";

type ParsedWorkbook = {
  fileName: string;
  workbook: XLSX.WorkBook;
  sheets: string[];
};

const DATASET_LABELS: Record<string, string> = {
  countries: "Countries",
  sources: "Sources",
  sipri_milex: "SIPRI Military Expenditure",
  imf_government_expenditure: "IMF Government Expenditure",
  budgets: "Budgets",
  government_spending: "Government Spending",
  equipment: "Equipment",
  equipment_categories: "Equipment Categories",
  country_equipment: "Country Equipment",
  companies: "Companies",
  programmes: "Programmes",
  contracts: "Contracts",
  contract_equipment: "Contract Equipment",
  programme_equipment: "Programme Equipment",
  procurement_events: "Procurement Events",
  conflicts: "Conflicts",
  conflict_parties: "Conflict Parties",
  conflict_incidents: "Conflict Incidents",
  conflict_events: "Conflict Events",
  ukraine_support: "Ukraine Support",
  training_exercises: "Training Exercises",
  carrier_air_wings: "Carrier Air Wings",
  carrier_air_wing_aircraft: "Carrier Air Wing Aircraft",
  ai_defence_projects: "AI Defence Projects",
};

const ALLOWED_DATASETS = Object.keys(
  DATASET_LABELS,
) as DatasetType[];

function normaliseHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function cleanValue(value: unknown): unknown {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (
      trimmed === "" ||
      trimmed.toLowerCase() === "null" ||
      trimmed.toLowerCase() === "undefined" ||
      trimmed.toLowerCase() === "nan"
    ) {
      return "";
    }

    return trimmed;
  }

  return value;
}

function cleanRows(rows: Row[]): Row[] {
  return rows.map((row) => {
    const cleaned: Row = {};

    Object.entries(row).forEach(([key, value]) => {
      const cleanKey = key.replace(/^\uFEFF/, "").trim();

      if (!cleanKey) return;

      cleaned[cleanKey] = cleanValue(value);
    });

    return cleaned;
  });
}

function normaliseRowsForApi(rows: Row[]): Row[] {
  return rows.map((row) => {
    const output: Row = {};

    Object.entries(row).forEach(([key, value]) => {
      output[normaliseHeader(key)] = cleanValue(value);
    });

    return output;
  });
}

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];

  let row: string[] = [];
  let field = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }

      row.push(field);
      field = "";

      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    field += char;
  }

  if (field !== "" || row.length > 0) {
    row.push(field);

    if (row.some((cell) => cell.trim() !== "")) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) =>
    header.replace(/^\uFEFF/, "").trim(),
  );

  return rows.slice(1).map((values) => {
    const output: Row = {};

    headers.forEach((header, index) => {
      if (!header) return;

      output[header] = cleanValue(values[index] ?? "");
    });

    return output;
  });
}

function detectSIPRI(
  rows: Row[],
  fileName: string,
  sheetName: string,
): boolean {
  const lowerFileName = fileName.toLowerCase();
  const lowerSheetName = sheetName.toLowerCase();

  if (
    lowerFileName.includes("sipri") ||
    lowerFileName.includes("milex")
  ) {
    return true;
  }

  if (lowerSheetName.includes("constant (2024) us$")) {
    return true;
  }

  if (rows.length === 0) {
    return false;
  }

  const headers = Object.keys(rows[0]).map(normaliseHeader);

  const hasLongFormat =
    headers.includes("sipri_country") &&
    headers.includes("year") &&
    (
      headers.includes("constant_amount_usd_millions") ||
      headers.includes("amount_usd_millions")
    );

  if (hasLongFormat) {
    return true;
  }

  const hasCountry =
    headers.includes("country") ||
    headers.includes("sipri_country");

  const hasYearColumns = headers.some((header) =>
    /^19\d{2}$|^20\d{2}$/.test(header),
  );

  return hasCountry && hasYearColumns;
}

function detectIMF(rows: Row[], fileName: string): boolean {
  const lowerFileName = fileName.toLowerCase();

  if (lowerFileName.includes("imf")) {
    return true;
  }

  if (rows.length === 0) {
    return false;
  }

  const headers = Object.keys(rows[0]).map(normaliseHeader);

  return (
    headers.includes("country_iso3") &&
    headers.includes("year") &&
    (
      headers.includes("expenditure_gdp_percent") ||
      headers.includes("total_expenditure_domestic_currency")
    )
  );
}

function detectConflictEvents(rows: Row[]): boolean {
  if (rows.length === 0) return false;

  const headers = Object.keys(rows[0]).map(normaliseHeader);

  const conflictTerms = [
    "event_date",
    "event_type",
    "conflict",
    "location",
    "actor",
    "fatalities",
    "date",
  ];

  const matches = conflictTerms.filter((term) =>
    headers.some((header) => header.includes(term)),
  ).length;

  return matches >= 2;
}

function detectDataset(
  rows: Row[],
  fileName: string,
  sheetName: string,
): DatasetType | null {
  if (detectSIPRI(rows, fileName, sheetName)) {
    return "sipri_milex";
  }

  if (detectIMF(rows, fileName)) {
    return "imf_government_expenditure";
  }

  if (detectConflictEvents(rows)) {
    return "conflict_events";
  }

  const headers = rows.length
    ? Object.keys(rows[0]).map(normaliseHeader)
    : [];

  if (
    headers.includes("iso_code") &&
    headers.includes("name")
  ) {
    return "countries";
  }

  if (
    headers.includes("publisher") &&
    headers.includes("url")
  ) {
    return "sources";
  }

  if (
    headers.includes("headquarters_country") &&
    headers.includes("name")
  ) {
    return "companies";
  }

  if (
    headers.includes("equipment_id") &&
    headers.includes("country_id")
  ) {
    return "country_equipment";
  }

  if (
    headers.includes("contract_id") &&
    headers.includes("equipment_id")
  ) {
    return "contract_equipment";
  }

  if (
    headers.includes("contract_id") &&
    headers.includes("event_type")
  ) {
    return "procurement_events";
  }

  if (
    headers.includes("programme_id") &&
    headers.includes("name")
  ) {
    return "programmes";
  }

  if (
    headers.includes("contract_id") ||
    headers.includes("company_id")
  ) {
    return "contracts";
  }

  if (
    headers.includes("country_id") &&
    headers.includes("year") &&
    (
      headers.includes("amount_usd") ||
      headers.includes("constant_amount_usd")
    )
  ) {
    return "budgets";
  }

  if (
    headers.includes("country_id") &&
    headers.includes("year") &&
    headers.includes("expenditure_gdp_percent")
  ) {
    return "government_spending";
  }

  if (
    headers.includes("equipment_id") ||
    headers.includes("equipment_name")
  ) {
    return "equipment";
  }

  if (
    headers.includes("conflict_id") &&
    headers.includes("party")
  ) {
    return "conflict_parties";
  }

  if (
    headers.includes("conflict_id") &&
    headers.includes("incident_date")
  ) {
    return "conflict_incidents";
  }

  if (
    headers.includes("conflict_id") ||
    headers.includes("conflict_name")
  ) {
    return "conflicts";
  }

  return null;
}

function isYearColumn(key: string): boolean {
  return /^(19|20)\d{2}$/.test(key.trim());
}

/**
 * SIPRI's Excel workbook is "wide":
 *
 * Country | 1949 | 1950 | ... | 2025
 *
 * The API expects long records:
 *
 * sipri_country | year | constant_amount_usd_millions
 *
 * This converts the selected SIPRI worksheet into that format.
 */
function convertSIPRIWorksheet(rows: Row[]): Row[] {
  const output: Row[] = [];

  for (const sourceRow of rows) {
    const country =
      sourceRow.Country ??
      sourceRow.country ??
      sourceRow.SIPRI_Country ??
      sourceRow.sipri_country;

    if (!country) {
      continue;
    }

    const countryName = String(country).trim();

    if (
      !countryName ||
      countryName.toLowerCase() === "country" ||
      countryName.toLowerCase() === "region"
    ) {
      continue;
    }

    for (const [key, value] of Object.entries(sourceRow)) {
      const yearKey = key.trim();

      if (!isYearColumn(yearKey)) {
        continue;
      }

      if (
        value === "" ||
        value === null ||
        value === undefined
      ) {
        continue;
      }

      if (
        typeof value === "string" &&
        (
          value.trim() === "..." ||
          value.trim().toLowerCase() === "xxx"
        )
      ) {
        continue;
      }

      const numericValue =
        typeof value === "number"
          ? value
          : Number(
              String(value)
                .replace(/,/g, "")
                .trim(),
            );

      if (!Number.isFinite(numericValue)) {
        continue;
      }

      output.push({
        sipri_country: countryName,
        year: Number(yearKey),
        constant_amount_usd_millions: numericValue,
      });
    }
  }

  return output;
}

async function readFileAsRows(
  file: File,
  sheetName?: string,
): Promise<{
  rows: Row[];
  workbook?: XLSX.WorkBook;
  sheets: string[];
  selectedSheet: string;
}> {
  const extension = file.name
    .split(".")
    .pop()
    ?.toLowerCase();

  if (extension === "csv") {
    const text = await file.text();

    return {
      rows: parseCsv(text),
      sheets: [],
      selectedSheet: "",
    };
  }

  if (
    extension === "xlsx" ||
    extension === "xls" ||
    extension === "xlsm"
  ) {
    const buffer = await file.arrayBuffer();

    const workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: false,
      cellNF: false,
      cellText: false,
    });

    const sheets = workbook.SheetNames;

    if (sheets.length === 0) {
      throw new Error("The Excel workbook contains no worksheets.");
    }

    const selected =
      sheetName && sheets.includes(sheetName)
        ? sheetName
        : sheets.includes("Constant (2024) US$")
          ? "Constant (2024) US$"
          : sheets[0];

    const worksheet = workbook.Sheets[selected];

    if (!worksheet) {
      throw new Error(
        `Worksheet "${selected}" could not be opened.`,
      );
    }

    const rows = XLSX.utils.sheet_to_json<Row>(
      worksheet,
      {
        defval: "",
        raw: true,
      },
    );

    return {
      rows: cleanRows(rows),
      workbook,
      sheets,
      selectedSheet: selected,
    };
  }

  throw new Error(
    "Unsupported file type. Use CSV, XLS, XLSX, or XLSM.",
  );
}

function getPreviewColumns(rows: Row[]): string[] {
  const columns = new Set<string>();

  rows.slice(0, 20).forEach((row) => {
    Object.keys(row).forEach((key) => {
      columns.add(key);
    });
  });

  return Array.from(columns).slice(0, 12);
}

function getPreviewRows(rows: Row[]): Row[] {
  return rows.slice(0, 10);
}

export default function BulkImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] =
    useState<ParsedWorkbook | null>(null);
  const [selectedSheet, setSelectedSheet] =
    useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [datasetType, setDatasetType] =
    useState<DatasetType | "">("");
  const [fileName, setFileName] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importedRows, setImportedRows] = useState(0);
  const [jobId, setJobId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [notes, setNotes] = useState("");

  const previewColumns = useMemo(
    () => getPreviewColumns(rows),
    [rows],
  );

  const previewRows = useMemo(
    () => getPreviewRows(rows),
    [rows],
  );

  const rowCount = rows.length;

  const tooLarge = rowCount > MAX_IMPORT_ROWS;

  const isSIPRI = datasetType === "sipri_milex";

  async function processSelectedFile(
    selectedFile: File,
    requestedSheet?: string,
  ) {
    setLoadingFile(true);
    setError("");
    setSuccess("");
    setImportedRows(0);
    setProgress(0);
    setJobId(null);

    try {
      const result = await readFileAsRows(
        selectedFile,
        requestedSheet,
      );

      let processedRows = normaliseRowsForApi(
        result.rows,
      );

      const detectedSIPRI = detectSIPRI(
  result.rows,
  selectedFile.name,
  result.selectedSheet,
);

const normalizedHeaders =
  result.rows.length > 0
    ? Object.keys(result.rows[0]).map(normaliseHeader)
    : [];

const isSIPRIWideFormat =
  normalizedHeaders.some((header) =>
    /^19\d{2}$|^20\d{2}$/.test(header),
  ) &&
  (
    normalizedHeaders.includes("country") ||
    normalizedHeaders.includes("sipri_country")
  );

if (detectedSIPRI && isSIPRIWideFormat) {
  processedRows = convertSIPRIWorksheet(
    result.rows,
  );
}

      const detected =
        detectedSIPRI
          ? "sipri_milex"
          : detectIMF(result.rows, selectedFile.name)
            ? "imf_government_expenditure"
            : detectConflictEvents(result.rows)
              ? "conflict_events"
              : detectDataset(
                  result.rows,
                  selectedFile.name,
                  result.selectedSheet,
                );

      setFile(selectedFile);
      setFileName(selectedFile.name);
      setRows(processedRows);
      setDatasetType(detected ?? "");

      setWorkbook({
        fileName: selectedFile.name,
        workbook:
          result.workbook ??
          XLSX.utils.book_new(),
        sheets: result.sheets,
      });

      setSelectedSheet(result.selectedSheet);
    } catch (err) {
      console.error(err);

      setFile(null);
      setWorkbook(null);
      setRows([]);
      setDatasetType("");

      setError(
        err instanceof Error
          ? err.message
          : "Could not read the selected file.",
      );
    } finally {
      setLoadingFile(false);
    }
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    await processSelectedFile(selectedFile);
  }

  async function handleSheetChange(
    event: ChangeEvent<HTMLSelectElement>,
  ) {
    const nextSheet = event.target.value;

    if (!file) return;

    setSelectedSheet(nextSheet);

    await processSelectedFile(
      file,
      nextSheet,
    );
  }

  async function importDataset() {
    if (!file) {
      setError("Select a file first.");
      return;
    }

    if (!datasetType) {
      setError(
        "The dataset type could not be detected. Select or prepare a supported dataset.",
      );
      return;
    }

    if (rows.length === 0) {
      setError("The selected dataset contains no importable rows.");
      return;
    }

    if (rows.length > MAX_IMPORT_ROWS) {
      setError(
        `This file contains ${rows.length.toLocaleString()} rows. The current maximum is ${MAX_IMPORT_ROWS.toLocaleString()} rows per import job.`,
      );
      return;
    }

    setImporting(true);
    setError("");
    setSuccess("");
    setImportedRows(0);
    setProgress(0);
    setJobId(null);

    let currentJobId: number | null = null;

    try {
      const totalRows = rows.length;

      for (
        let chunkStart = 0;
        chunkStart < totalRows;
        chunkStart += CHUNK_SIZE
      ) {
        const chunk = rows.slice(
          chunkStart,
          Math.min(
            chunkStart + CHUNK_SIZE,
            totalRows,
          ),
        );

        const response = await csrfFetch(
          "/api/intelligence/import",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fileName: file.name,
              recordType: datasetType,
              rows: chunk,
              totalRows,
              chunkStart,
              jobId: currentJobId,
              notes: notes.trim() || null,
            }),
          },
        );

        let payload: {
          error?: string;
          jobId?: number;
          imported?: number;
          valid?: number;
          invalid?: number;
        } = {};

        try {
          payload = await response.json();
        } catch {
          throw new Error(
            `Import API returned an invalid response (${response.status}).`,
          );
        }

        if (!response.ok) {
          throw new Error(
            payload.error ||
              `Import failed with HTTP ${response.status}.`,
          );
        }

        if (payload.jobId) {
          currentJobId = payload.jobId;
          setJobId(payload.jobId);
        }

        const completed =
          Math.min(
            chunkStart + chunk.length,
            totalRows,
          );

        setImportedRows(completed);
        setProgress(
          Math.round(
            (completed / totalRows) * 100,
          ),
        );
      }

      setSuccess(
        `Import completed. ${totalRows.toLocaleString()} rows were sent in ${Math.ceil(
          totalRows / CHUNK_SIZE,
        ).toLocaleString()} request${
          Math.ceil(totalRows / CHUNK_SIZE) === 1
            ? ""
            : "s"
        }.`,
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "The import failed.",
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#020617] text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10">
          <div className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
            Administration
          </div>

          <h1 className="text-3xl font-semibold tracking-tight">
            Bulk Import
          </h1>

          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-400">
            Upload large defence datasets, inspect the parsed
            data, select the appropriate worksheet, and import
            the dataset in controlled API chunks.
          </p>
        </div>

        <div className="space-y-6">
          {/* 1. Upload */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
            <div className="mb-5">
              <div className="text-sm font-medium text-slate-400">
                1. Upload
              </div>

              <h2 className="mt-1 text-xl font-semibold">
                Select a dataset
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Supported formats: CSV, XLS, XLSX and XLSM.
                Excel files are parsed as spreadsheets rather
                than as plain text.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex cursor-pointer items-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200">
                Choose file
                <input
                  type="file"
                  accept=".csv,.xls,.xlsx,.xlsm"
                  onChange={handleFileChange}
                  disabled={loadingFile || importing}
                  className="hidden"
                />
              </label>

              {fileName && (
                <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                  {fileName}
                </div>
              )}

              {file && (
               <button
  type="button"
  onClick={importDataset}
  disabled={
    importing ||
    loadingFile ||
    tooLarge
  }
  className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
>
  {importing ? "Importing..." : "Import dataset"}
</button>
              )}
            </div>

            {loadingFile && (
              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 px-4 py-4 text-sm text-slate-300">
                Reading workbook and parsing worksheet...
              </div>
            )}
          </section>

          {/* 2. Workbook */}
          {workbook && workbook.sheets.length > 0 && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
              <div className="mb-5">
                <div className="text-sm font-medium text-slate-400">
                  2. Worksheet
                </div>

                <h2 className="mt-1 text-xl font-semibold">
                  Choose the worksheet
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Excel workbooks can contain multiple
                  worksheets. Choose the one containing the
                  dataset you want to import.
                </p>
              </div>

              <div className="max-w-xl">
                <label
                  htmlFor="worksheet"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Worksheet
                </label>

                <select
                  id="worksheet"
                  value={selectedSheet}
                  onChange={handleSheetChange}
                  disabled={loadingFile || importing}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-slate-500"
                >
                  {workbook.sheets.map((sheet) => (
                    <option
                      key={sheet}
                      value={sheet}
                    >
                      {sheet}
                    </option>
                  ))}
                </select>
              </div>

              {isSIPRI && (
                <div className="mt-5 rounded-xl border border-sky-900/60 bg-sky-950/30 px-4 py-4">
                  <div className="text-sm font-semibold text-sky-300">
                    SIPRI workbook detected
                  </div>

                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    The selected worksheet is being converted
                    from SIPRI&apos;s wide year-by-year format
                    into one country-year record per observation.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* 3. Detection */}
          {file && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
              <div className="mb-5">
                <div className="text-sm font-medium text-slate-400">
                  3. Dataset
                </div>

                <h2 className="mt-1 text-xl font-semibold">
                  Dataset detected
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Dataset
                  </div>

                  <div className="mt-2 text-lg font-semibold">
                    {datasetType
                      ? DATASET_LABELS[
                          datasetType
                        ]
                      : "Not detected"}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Rows
                  </div>

                  <div className="mt-2 text-lg font-semibold">
                    {rowCount.toLocaleString()}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Requests
                  </div>

                  <div className="mt-2 text-lg font-semibold">
                    {Math.ceil(
                      rowCount / CHUNK_SIZE,
                    ).toLocaleString()}
                  </div>
                </div>
              </div>

              {!datasetType && (
                <div className="mt-5 rounded-xl border border-amber-900/60 bg-amber-950/20 px-4 py-4 text-sm text-amber-300">
                  The file was read successfully, but the
                  dataset type could not be detected automatically.
                  The current API only accepts supported dataset
                  types.
                </div>
              )}

              {tooLarge && (
                <div className="mt-5 rounded-xl border border-red-900/60 bg-red-950/20 px-4 py-4 text-sm text-red-300">
                  This dataset contains{" "}
                  {rowCount.toLocaleString()} rows. The current
                  import-job limit is{" "}
                  {MAX_IMPORT_ROWS.toLocaleString()} rows.
                </div>
              )}
            </section>
          )}

          {/* 4. Preview */}
          {file && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
              <div className="mb-5">
                <div className="text-sm font-medium text-slate-400">
                  4. Preview
                </div>

                <h2 className="mt-1 text-xl font-semibold">
                  Parsed data
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Showing the first{" "}
                  {Math.min(
                    previewRows.length,
                    10,
                  )}{" "}
                  parsed rows.
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-950">
                    <tr>
                      {previewColumns.map(
                        (column) => (
                          <th
                            key={column}
                            className="whitespace-nowrap border-b border-slate-800 px-4 py-3 font-medium text-slate-400"
                          >
                            {column}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {previewRows.map(
                      (row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className="border-b border-slate-800/70 last:border-b-0"
                        >
                          {previewColumns.map(
                            (column) => (
                              <td
                                key={column}
                                className="max-w-xs whitespace-nowrap px-4 py-3 text-slate-300"
                              >
                                {String(
                                  row[column] ??
                                    "",
                                )}
                              </td>
                            ),
                          )}
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 5. Import */}
      {file && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
              <div className="mb-5">
                <div className="text-sm font-medium text-slate-400">
                  5. Import
                </div>

                <h2 className="mt-1 text-xl font-semibold">
                  Import dataset
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  The complete file is kept as one import job.
                  Requests are sent in{" "}
                  {CHUNK_SIZE.toLocaleString()}-row chunks.
                </p>
              </div>

              <div className="mb-5 max-w-2xl">
                <label
                  htmlFor="notes"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Import notes
                </label>

                <textarea
                  id="notes"
                  value={notes}
                  onChange={(event) =>
                    setNotes(
                      event.target.value,
                    )
                  }
                  disabled={importing}
                  rows={3}
                  placeholder="Optional notes about this dataset or import..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-500"
                />
              </div>

              <button
                type="button"
                onClick={importDataset}
                disabled={
                  importing ||
                  loadingFile ||
                  tooLarge ||
                  !datasetType ||
                  rows.length === 0
                }
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing
                  ? "Importing..."
                  : "Import dataset"}
              </button>

              {importing && (
                <div className="mt-6 max-w-2xl">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-slate-400">
                      Import progress
                    </span>

                    <span className="font-medium text-slate-200">
                      {progress}%
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-slate-300 transition-all duration-300"
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>

                  <div className="mt-2 text-sm text-slate-500">
                    {importedRows.toLocaleString()} /{" "}
                    {rowCount.toLocaleString()} rows sent
                  </div>

                  {jobId && (
                    <div className="mt-2 text-xs text-slate-600">
                      Import job #{jobId}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Errors */}
          {error && (
            <div className="rounded-xl border border-red-900/60 bg-red-950/30 px-5 py-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/30 px-5 py-4 text-sm text-emerald-300">
              {success}
              {jobId && (
                <div className="mt-1 text-xs text-emerald-500">
                  Import job #{jobId}
                </div>
              )}
            </div>
          )}

          {/* Supported datasets */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
            <div className="mb-5">
              <div className="text-sm font-medium text-slate-400">
                Supported datasets
              </div>

              <h2 className="mt-1 text-xl font-semibold">
                Import types
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ALLOWED_DATASETS.map(
                (dataset) => (
                  <div
                    key={dataset}
                    className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-4 text-sm text-slate-300"
                  >
                    {DATASET_LABELS[dataset]}
                  </div>
                ),
              )}
            </div>

            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 px-4 py-4">
              <div className="text-sm font-semibold text-slate-300">
                Current limits
              </div>

              <div className="mt-2 space-y-1 text-sm text-slate-500">
                <div>
                  Maximum rows per import job:{" "}
                  {MAX_IMPORT_ROWS.toLocaleString()}
                </div>

                <div>
                  Maximum rows per API request:{" "}
                  {CHUNK_SIZE.toLocaleString()}
                </div>

                <div>
                  A {MAX_IMPORT_ROWS.toLocaleString()}-row file
                  therefore uses{" "}
                  {Math.ceil(
                    MAX_IMPORT_ROWS /
                      CHUNK_SIZE,
                  ).toLocaleString()}{" "}
                  requests.
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}