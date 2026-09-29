import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/supabase/server";
import { requireCsrfOrBearer } from "@/lib/security/csrf";

type ImportRow = {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
};

const MAX_IMPORT_ROWS = 500000;
const MAX_CHUNK_ROWS = 25000;

const allowedRecordTypes = [
  "countries",
  "sources",
  "sipri_milex",
  "imf_government_expenditure",
  "budgets",
  "government_spending",
  "equipment",
  "equipment_categories",
  "country_equipment",
  "companies",
  "programmes",
  "contracts",
  "contract_equipment",
  "programme_equipment",
  "procurement_events",
  "conflicts",
  "conflict_parties",
  "conflict_incidents",
  "conflict_events",
  "ukraine_support",
  "training_exercises",
  "carrier_air_wings",
  "carrier_air_wing_aircraft",
  "ai_defence_projects",
] as const;

type RecordType = (typeof allowedRecordTypes)[number];

const requiredFields: Record<RecordType, string[]> = {
  countries: ["name"],

  sources: ["title"],

  sipri_milex: [
    "sipri_country",
    "year",
  ],

  imf_government_expenditure: [
    "country_iso3",
    "year",
  ],

  budgets: [
    "country_id",
    "year",
  ],

  government_spending: [
    "country_id",
    "year",
  ],

  equipment_categories: ["slug"],

  equipment: ["name"],

  country_equipment: [
    "country_id",
    "equipment_id",
  ],

  companies: ["name"],

  programmes: ["name"],

  contracts: ["title"],

  contract_equipment: [
    "contract_id",
    "equipment_id",
  ],

  programme_equipment: [
    "programme_id",
    "equipment_id",
  ],

  procurement_events: [
    "event_type",
    "event_date",
    "title",
  ],

  conflicts: ["name"],

  conflict_parties: [
    "conflict_id",
    "name",
  ],

  conflict_incidents: [
    "conflict_id",
    "incident_date",
    "title",
  ],

  conflict_events: [
    "week",
    "region",
    "country",
    "event_type",
    "sub_event_type",
    "events",
    "fatalities",
  ],

  ukraine_support: [
    "donor_country",
    "announcement_date",
    "aid_type",
    "item",
  ],

  training_exercises: ["name"],

  carrier_air_wings: ["country_id", "wing_name"],

  carrier_air_wing_aircraft: ["wing_id", "equipment_id"],

  ai_defence_projects: ["country_id", "programme_name"],
};

const integerFields = new Set([
  "id",
  "country_id",
  "equipment_id",
  "carrier_holding_id",
  "wing_id",
  "rated_capacity",
  "current_aircraft_count",
  "operational_qty",
  "maintenance_qty",
  "company_id",
  "programme_id",
  "contract_id",
  "conflict_id",
  "quantity",
  "year",
  "events",
  "fatalities",
  "quantity_delivered",
]);

const numericFields = new Set([
  "amount_usd",
  "amount_usd_millions",
  "constant_amount_usd",
  "constant_amount_usd_millions",
  "percentage_gdp",
  "percentage_government_spending",
  "total_expenditure_usd",
  "total_expenditure_domestic_currency",
  "expenditure_gdp_percent",
  "value",
  "value_eur",
  "budget_value",
  "reliability_score",
  "population_exposure",
  "latitude",
  "longitude",
  "centroid_latitude",
  "centroid_longitude",
]);

const dateFields = new Set([
  "publication_date",
  "contract_date",
  "announced_date",
  "award_date",
  "delivery_start_date",
  "delivery_end_date",
  "event_date",
  "start_date",
  "expected_completion_date",
  "incident_date",
  "announcement_date",
]);

function cleanValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const result = String(value).trim();

  if (
    result.toLowerCase() === "nan" ||
    result.toLowerCase() === "null" ||
    result.toLowerCase() === "undefined"
  ) {
    return "";
  }

  return result;
}

function isBlank(value: unknown): boolean {
  return cleanValue(value) === "";
}

function isNumeric(value: string): boolean {
  const cleaned = cleanValue(value)
    .replace(/,/g, "")
    .replace(/%/g, "");

  if (!cleaned) {
    return true;
  }

  return /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(
    cleaned,
  );
}

function isInteger(value: string): boolean {
  const cleaned = cleanValue(value).replace(/,/g, "");

  if (!cleaned) {
    return true;
  }

  return /^-?\d+$/.test(cleaned);
}

function isDate(value: string): boolean {
  const cleaned = cleanValue(value);

  if (!cleaned) {
    return true;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return false;
  }

  const date = new Date(`${cleaned}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().startsWith(cleaned)
  );
}

function validateSipriRow(
  data: Record<string, string>,
): string[] {
  const errors: string[] = [];

  if (isBlank(data.sipri_country)) {
    errors.push("Missing SIPRI country name.");
  }

  if (isBlank(data.year)) {
    errors.push("Missing SIPRI year.");
  } else if (!/^\d{4}$/.test(data.year)) {
    errors.push("SIPRI year must contain four digits.");
  }

  const hasMeasure =
    !isBlank(data.constant_amount_usd_millions) ||
    !isBlank(data.amount_usd_millions) ||
    !isBlank(data.percentage_gdp) ||
    !isBlank(data.percentage_government_spending);

  if (!hasMeasure) {
    errors.push(
      "SIPRI row contains no expenditure or burden value.",
    );
  }

  for (const field of [
    "constant_amount_usd_millions",
    "amount_usd_millions",
    "percentage_gdp",
    "percentage_government_spending",
  ]) {
    if (!isNumeric(data[field] || "")) {
      errors.push(`${field} must be numeric.`);
    }
  }

  return errors;
}

function validateImfRow(
  data: Record<string, string>,
): string[] {
  const errors: string[] = [];

  if (isBlank(data.country_iso3)) {
    errors.push("Missing IMF ISO-3 country code.");
  } else if (!/^[A-Za-z]{3}$/.test(data.country_iso3)) {
    errors.push(
      "IMF country_iso3 must contain exactly three letters.",
    );
  }

  if (isBlank(data.year)) {
    errors.push("Missing IMF year.");
  } else if (!/^\d{4}$/.test(data.year)) {
    errors.push("IMF year must contain four digits.");
  }

  if (
    !isBlank(data.expenditure_gdp_percent) &&
    !isNumeric(data.expenditure_gdp_percent)
  ) {
    errors.push(
      "expenditure_gdp_percent must be numeric.",
    );
  }

  if (
    !isBlank(data.total_expenditure_domestic_currency) &&
    !isNumeric(data.total_expenditure_domestic_currency)
  ) {
    errors.push(
      "total_expenditure_domestic_currency must be numeric.",
    );
  }

  return errors;
}

function validateConflictEventRow(
  data: Record<string, string>,
): string[] {
  const errors: string[] = [];

  if (isBlank(data.week)) {
    errors.push("Missing conflict event week.");
  }

  if (isBlank(data.region)) {
    errors.push("Missing conflict event region.");
  }

  if (isBlank(data.country)) {
    errors.push("Missing conflict event country.");
  }

  if (isBlank(data.event_type)) {
    errors.push("Missing conflict event type.");
  }

  if (isBlank(data.sub_event_type)) {
    errors.push("Missing conflict sub-event type.");
  }

  if (isBlank(data.events)) {
    errors.push("Missing event count.");
  } else if (!isInteger(data.events)) {
    errors.push("events must be an integer.");
  }

  if (
    !isBlank(data.fatalities) &&
    !isInteger(data.fatalities)
  ) {
    errors.push("fatalities must be an integer.");
  }

  if (
    !isBlank(data.population_exposure) &&
    !isNumeric(data.population_exposure)
  ) {
    errors.push("population_exposure must be numeric.");
  }

  if (
    !isBlank(data.centroid_latitude) &&
    !isNumeric(data.centroid_latitude)
  ) {
    errors.push("centroid_latitude must be numeric.");
  }

  if (
    !isBlank(data.centroid_longitude) &&
    !isNumeric(data.centroid_longitude)
  ) {
    errors.push("centroid_longitude must be numeric.");
  }

  return errors;
}

function validateUkraineSupportRow(
  data: Record<string, string>,
): string[] {
  const errors: string[] = [];

  if (isBlank(data.donor_country)) {
    errors.push("Missing donor country.");
  }

  if (isBlank(data.announcement_date)) {
    errors.push("Missing announcement date.");
  }

  if (isBlank(data.aid_type)) {
    errors.push("Missing aid type.");
  }

  if (isBlank(data.item)) {
    errors.push("Missing supported item.");
  }

  if (
    !isBlank(data.announcement_date) &&
    !isDate(data.announcement_date)
  ) {
    errors.push(
      "announcement_date must use YYYY-MM-DD format.",
    );
  }

  if (
    !isBlank(data.quantity) &&
    !isInteger(data.quantity)
  ) {
    errors.push("quantity must be an integer.");
  }

  if (
    !isBlank(data.quantity_delivered) &&
    !isInteger(data.quantity_delivered)
  ) {
    errors.push("quantity_delivered must be an integer.");
  }

  if (
    !isBlank(data.value) &&
    !isNumeric(data.value)
  ) {
    errors.push("value must be numeric.");
  }

  if (
    !isBlank(data.value_eur) &&
    !isNumeric(data.value_eur)
  ) {
    errors.push("value_eur must be numeric.");
  }

  return errors;
}

function validateStandardRow(
  recordType: RecordType,
  data: Record<string, string>,
): string[] {
  const errors: string[] = [];

  for (const field of requiredFields[recordType]) {
    if (isBlank(data[field])) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (
    data.iso_code &&
    !/^[A-Za-z]{2,3}$/.test(data.iso_code)
  ) {
    errors.push(
      "ISO code must contain 2 or 3 letters.",
    );
  }

  for (const field of integerFields) {
    if (!isInteger(data[field] || "")) {
      errors.push(`${field} must be an integer.`);
    }
  }

  for (const field of numericFields) {
    if (!isNumeric(data[field] || "")) {
      errors.push(`${field} must be numeric.`);
    }
  }

  for (const field of dateFields) {
    if (!isDate(data[field] || "")) {
      errors.push(
        `${field} must use YYYY-MM-DD format.`,
      );
    }
  }

  return errors;
}

function validateRow(
  recordType: RecordType,
  data: Record<string, string>,
): string[] {
  if (recordType === "sipri_milex") {
    return validateSipriRow(data);
  }

  if (recordType === "imf_government_expenditure") {
    return validateImfRow(data);
  }

  if (recordType === "conflict_events") {
    return validateConflictEventRow(data);
  }

  if (recordType === "ukraine_support") {
    return validateUkraineSupportRow(data);
  }

  return validateStandardRow(recordType, data);
}

function normaliseData(
  row: unknown,
): Record<string, string> {
  if (
    !row ||
    typeof row !== "object" ||
    Array.isArray(row)
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(row as Record<string, unknown>).map(
      ([key, value]) => [
        key
          .replace(/^\uFEFF/, "")
          .trim()
          .toLowerCase(),
        cleanValue(value),
      ],
    ),
  );
}

export async function POST(request: Request) {
  try {
    const csrfCheck = requireCsrfOrBearer(request);
    if (csrfCheck) return csrfCheck;

    const auth = await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const { supabase, user } = auth;

    const body = await request.json();

    const fileName =
      typeof body.fileName === "string"
        ? body.fileName.trim()
        : "";

    const recordType =
      typeof body.recordType === "string"
        ? body.recordType.trim()
        : "";

    const incomingRows = Array.isArray(body.rows)
      ? body.rows
      : [];

    const incomingJobId =
      typeof body.jobId === "number"
        ? body.jobId
        : null;

    const totalRows =
      typeof body.totalRows === "number"
        ? body.totalRows
        : null;

    const chunkStart =
      typeof body.chunkStart === "number"
        ? body.chunkStart
        : 0;

    if (!fileName || !recordType) {
      return NextResponse.json(
        {
          error:
            "File name and record type are required.",
        },
        { status: 400 },
      );
    }

    if (
      !(allowedRecordTypes as readonly string[]).includes(
        recordType,
      )
    ) {
      return NextResponse.json(
        {
          error: "Unsupported record type.",
        },
        { status: 400 },
      );
    }

    if (
      totalRows !== null &&
      (!Number.isInteger(totalRows) ||
        totalRows <= 0 ||
        totalRows > MAX_IMPORT_ROWS)
    ) {
      return NextResponse.json(
        {
          error:
            `A single import may contain up to ` +
            `${MAX_IMPORT_ROWS.toLocaleString()} rows.`,
        },
        { status: 400 },
      );
    }

    if (
      incomingRows.length === 0 ||
      incomingRows.length > MAX_CHUNK_ROWS
    ) {
      return NextResponse.json(
        {
          error:
            `Each request may contain up to ` +
            `${MAX_CHUNK_ROWS.toLocaleString()} rows.`,
        },
        { status: 400 },
      );
    }

    if (
      !Number.isInteger(chunkStart) ||
      chunkStart < 0 ||
      (totalRows !== null &&
        chunkStart >= totalRows)
    ) {
      return NextResponse.json(
        {
          error: "Invalid chunk position.",
        },
        { status: 400 },
      );
    }

    let jobId = incomingJobId;

    /*
     * Create the import job only for the first chunk.
     * Every following chunk reuses the same job.
     */
    if (jobId === null) {
      const { data: job, error: jobError } =
        await supabase
          .from("bulk_import_jobs")
          .insert({
            created_by: user.id,
            file_name: fileName,
            record_type: recordType,
            row_count: totalRows ?? incomingRows.length,
            valid_row_count: 0,
            invalid_row_count: 0,
            status: "uploaded",
          })
          .select("id")
          .single();

      if (jobError || !job) {
        return NextResponse.json(
          {
            error:
              jobError?.message ||
              "Could not create import job.",
          },
          { status: 500 },
        );
      }

      jobId = job.id;
    } else {
      const { data: existingJob, error: jobLookupError } =
        await supabase
          .from("bulk_import_jobs")
          .select(
            "id, created_by, file_name, record_type, status",
          )
          .eq("id", jobId)
          .eq("created_by", user.id)
          .single();

      if (jobLookupError || !existingJob) {
        return NextResponse.json(
          {
            error: "Import job not found.",
          },
          { status: 404 },
        );
      }

      if (existingJob.file_name !== fileName) {
        return NextResponse.json(
          {
            error:
              "Import job file name does not match.",
          },
          { status: 400 },
        );
      }

      if (existingJob.record_type !== recordType) {
        return NextResponse.json(
          {
            error:
              "Import job record type does not match.",
          },
          { status: 400 },
        );
      }
    }

    const rows: ImportRow[] = incomingRows.map(
      (row: unknown, index: number) => {
        const data = normaliseData(row);

        return {
          rowNumber: chunkStart + index + 2,
          data,
          errors: validateRow(
            recordType as RecordType,
            data,
          ),
        };
      },
    );

    const validRowCount = rows.filter(
      (row) => row.errors.length === 0,
    ).length;

    const invalidRowCount =
      rows.length - validRowCount;

    const rowPayload = rows.map((row) => ({
      job_id: jobId,
      row_number: row.rowNumber,
      row_data: row.data,
      is_valid: row.errors.length === 0,
      validation_errors: row.errors,
    }));

    const { error: rowsError } =
      await supabase
        .from("bulk_import_rows")
        .insert(rowPayload);

    if (rowsError) {
      return NextResponse.json(
        {
          error: rowsError.message,
        },
        { status: 500 },
      );
    }

    /*
     * Update cumulative counters for this single job.
     */
    const { data: currentJob, error: currentJobError } =
      await supabase
        .from("bulk_import_jobs")
        .select(
          "row_count, valid_row_count, invalid_row_count",
        )
        .eq("id", jobId)
        .eq("created_by", user.id)
        .single();

    if (currentJobError || !currentJob) {
      return NextResponse.json(
        {
          error:
            currentJobError?.message ||
            "Could not read import job.",
        },
        { status: 500 },
      );
    }

    const cumulativeValid =
      Number(currentJob.valid_row_count || 0) +
      validRowCount;

    const cumulativeInvalid =
      Number(currentJob.invalid_row_count || 0) +
      invalidRowCount;

    const expectedTotal =
      totalRows ??
      Number(currentJob.row_count || 0);

    const processedRows =
      Math.min(
        expectedTotal,
        Math.max(
          chunkStart + incomingRows.length,
          0,
        ),
      );

    const finished =
      processedRows >= expectedTotal;

    const finalStatus = finished
      ? cumulativeInvalid > 0
        ? "needs_review"
        : "validated"
      : "uploaded";

    const { error: updateError } =
      await supabase
        .from("bulk_import_jobs")
        .update({
          valid_row_count: cumulativeValid,
          invalid_row_count: cumulativeInvalid,
          status: finalStatus,
        })
        .eq("id", jobId)
        .eq("created_by", user.id);

    if (updateError) {
      return NextResponse.json(
        {
          error: updateError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      jobId,
      rowCount: rows.length,
      validRowCount,
      invalidRowCount,
      cumulativeValidRowCount: cumulativeValid,
      cumulativeInvalidRowCount: cumulativeInvalid,
      processedRows,
      totalRows: expectedTotal,
      completed: finished,
      status: finalStatus,
    });
  } catch (error) {
    console.error(
      "Bulk import error:",
      error,
    );

    return NextResponse.json(
      {
        error: "Invalid import request.",
      },
      { status: 400 },
    );
  }
}