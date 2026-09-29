import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getSupplementalDatasetEntries,
  getDatasetCoverageStatus,
} from "@/lib/sipri";

type ProgrammeSummary = {
  programme_id: number;
  programme_name: string;
  country_id: number | null;
  country_name: string | null;
  status: string | null;
  programme_type: string | null;
  start_date: string | null;
  expected_completion_date: string | null;
  budget_value: number | null;
  currency: string | null;
  data_confidence: string | null;
  description: string | null;
  contract_count: number | null;
  total_contract_value: number | null;
  company_count: number | null;
  procurement_event_count: number | null;
  latest_procurement_date: string | null;
  intelligence_change_count: number | null;
};

function formatMoney(
  value: number | null,
  currency: string | null,
) {
  if (value == null || !Number.isFinite(Number(value))) {
    return "Not available";
  }

  const number = Number(value);
  const code = currency || "USD";

  if (number >= 1_000_000_000) {
    return `${code} ${(number / 1_000_000_000).toFixed(1)}bn`;
  }

  if (number >= 1_000_000) {
    return `${code} ${(number / 1_000_000).toFixed(1)}m`;
  }

  if (number >= 1_000) {
    return `${code} ${(number / 1_000).toFixed(1)}k`;
  }

  return `${code} ${number.toLocaleString()}`;
}

function formatDate(value: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="intel-metric">
      <p className="intel-metric-label">{label}</p>
      <p className="intel-metric-value">{value}</p>
    </div>
  );
}

function DataRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="intel-data-row">
      <dt className="intel-data-label">{label}</dt>
      <dd className="intel-data-value">{children}</dd>
    </div>
  );
}

export default async function ProgrammeIntelligenceSummary({
  programmeId,
}: {
  programmeId: number;
}) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("programme_intelligence_summary")
    .select("*")
    .eq("programme_id", programmeId)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const programme = data as ProgrammeSummary;
  const supplementalEntries = await getSupplementalDatasetEntries(
    programme.country_name,
  );
  const datasetCoverage = await getDatasetCoverageStatus();

  return (
    <section
      className="intel-section space-y-6"
      aria-labelledby="programme-intelligence-heading"
    >
      <div>
        <h2
          id="programme-intelligence-heading"
          className="intel-section-heading"
        >
          Intelligence overview
        </h2>

        <p className="intel-section-description">
          Structured indicators derived from programme, contract,
          procurement and intelligence data.
        </p>
      </div>

      <div className="intel-metrics">
        <Metric
          label="Contracts"
          value={programme.contract_count ?? 0}
        />

        <Metric
          label="Contract value"
          value={formatMoney(
            programme.total_contract_value,
            programme.currency,
          )}
        />

        <Metric
          label="Companies"
          value={programme.company_count ?? 0}
        />

        <Metric
          label="Procurement events"
          value={programme.procurement_event_count ?? 0}
        />
      </div>

      <section className="intel-panel">
        <div className="intel-panel-header">
          <h3 className="intel-panel-title">
            Programme status
          </h3>
        </div>

        <dl className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border-b border-slate-800 px-4 py-3 lg:border-b-0 lg:border-r">
            <dt className="intel-metric-label">Status</dt>
            <dd className="mt-1 text-sm font-medium text-slate-200">
              {programme.status || "Not available"}
            </dd>
          </div>

          <div className="border-b border-slate-800 px-4 py-3 lg:border-b-0 lg:border-r">
            <dt className="intel-metric-label">
              Programme type
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-200">
              {programme.programme_type || "Not available"}
            </dd>
          </div>

          <div className="border-b border-slate-800 px-4 py-3 lg:border-b-0 lg:border-r">
            <dt className="intel-metric-label">
              Start date
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-200">
              {formatDate(programme.start_date)}
            </dd>
          </div>

          <div className="px-4 py-3">
            <dt className="intel-metric-label">
              Expected completion
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-200">
              {formatDate(programme.expected_completion_date)}
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="intel-panel">
          <div className="intel-panel-header">
            <h3 className="intel-panel-title">
              Programme details
            </h3>
          </div>

          <div className="intel-panel-body">
            <dl className="intel-data-list">
              {programme.country_name && (
                <DataRow label="Country">
                  {programme.country_id ? (
                    <Link
                      href={`/countries/${programme.country_id}`}
                      className="intel-link"
                    >
                      {programme.country_name}
                    </Link>
                  ) : (
                    programme.country_name
                  )}
                </DataRow>
              )}

              {programme.budget_value != null && (
                <DataRow label="Programme budget">
                  {formatMoney(
                    programme.budget_value,
                    programme.currency,
                  )}
                </DataRow>
              )}

              {programme.data_confidence && (
                <DataRow label="Data confidence">
                  {programme.data_confidence}
                </DataRow>
              )}

              {supplementalEntries.length > 0 &&
                supplementalEntries.map((entry) => (
                  <DataRow key={entry.name} label={entry.label}>
                    <span>{entry.value}</span>
                    {entry.note && (
                      <span className="mt-1 block text-[10px] uppercase tracking-wide text-slate-500">
                        {entry.note}
                      </span>
                    )}
                  </DataRow>
                ))}
            </dl>
          </div>
        </section>

        <section className="intel-panel">
          <div className="intel-panel-header">
            <h3 className="intel-panel-title">
              Procurement & intelligence
            </h3>
          </div>

          <div className="intel-panel-body">
            <dl className="intel-data-list">
              <DataRow label="Latest procurement">
                {formatDate(
                  programme.latest_procurement_date,
                )}
              </DataRow>

              <DataRow label="Intelligence changes">
                {programme.intelligence_change_count ?? 0}
              </DataRow>
            </dl>

            <Link
              href={`/changes?entity=programme&entityId=${programme.programme_id}`}
              className="intel-link mt-4 inline-flex text-sm"
            >
              View programme changes
            </Link>
          </div>
        </section>
      </div>

      {supplementalEntries.length > 0 && (
        <section className="intel-panel">
          <div className="intel-panel-header">
            <h3 className="intel-panel-title">
              Supplemental datasets
            </h3>
          </div>

          <div className="intel-panel-body">
            <dl className="intel-data-list">
              {supplementalEntries.map((entry) => (
                <DataRow key={`${entry.name}-${entry.label}`} label={entry.name}>
                  <div>
                    <div>{entry.value}</div>
                    {entry.note && (
                      <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
                        {entry.note}
                      </div>
                    )}
                    <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                      {entry.source}
                    </div>
                  </div>
                </DataRow>
              ))}
            </dl>
          </div>
        </section>
      )}

      {datasetCoverage.length > 0 && (
        <section className="intel-panel">
          <div className="intel-panel-header">
            <h3 className="intel-panel-title">
              Dataset coverage
            </h3>
          </div>

          <div className="intel-panel-body">
            <dl className="intel-data-list">
              {datasetCoverage.map((dataset) => (
                <DataRow key={dataset.name} label={dataset.name}>
                  <span>{dataset.status}</span>
                </DataRow>
              ))}
            </dl>
          </div>
        </section>
      )}

      {programme.description && (
        <section className="intel-panel">
          <div className="intel-panel-header">
            <h3 className="intel-panel-title">
              Description
            </h3>
          </div>

          <div className="intel-panel-body">
            <p className="max-w-4xl text-sm leading-6 text-slate-400">
              {programme.description}
            </p>
          </div>
        </section>
      )}
    </section>
  );
}