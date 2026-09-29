import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type CompanySummary = {
  company_id: number;
  company_name: string;
  headquarters_country: string | null;
  country_id: number | null;
  company_type: string | null;
  ownership_type: string | null;
  description: string | null;
  website: string | null;
  parent_company_id: number | null;
  source_id: number | null;
  data_confidence: string | null;
  contract_count: number | null;
  valued_contract_count: number | null;
  total_contract_value: number | null;
  programme_count: number | null;
  country_count: number | null;
  procurement_event_count: number | null;
  latest_procurement_date: string | null;
  intelligence_change_count: number | null;
};

function formatMoney(value: number | null) {
  if (value == null || !Number.isFinite(Number(value))) {
    return "Not available";
  }

  const number = Number(value);

  if (number >= 1_000_000_000) {
    return `$${(number / 1_000_000_000).toFixed(1)}bn`;
  }

  if (number >= 1_000_000) {
    return `$${(number / 1_000_000).toFixed(1)}m`;
  }

  if (number >= 1_000) {
    return `$${(number / 1_000).toFixed(1)}k`;
  }

  return `$${number.toLocaleString()}`;
}

export default async function CompanyIntelligenceSummary({
  companyId,
}: {
  companyId: number;
}) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("company_intelligence_summary")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const company = data as CompanySummary;

  return (
    <section className="space-y-4" aria-labelledby="company-intelligence-heading">
      <div>
        <h2 id="company-intelligence-heading" className="text-xl font-semibold">
          Intelligence overview
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Structured indicators derived from contracts, procurement activity and
          intelligence changes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Contracts</p>
          <p className="mt-2 text-2xl font-semibold">
            {company.contract_count ?? 0}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Contract value</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatMoney(company.total_contract_value)}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Programmes</p>
          <p className="mt-2 text-2xl font-semibold">
            {company.programme_count ?? 0}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Countries</p>
          <p className="mt-2 text-2xl font-semibold">
            {company.country_count ?? 0}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">
            Procurement events
          </p>
          <p className="mt-1 text-lg font-semibold">
            {company.procurement_event_count ?? 0}
          </p>

          {company.latest_procurement_date && (
            <p className="mt-1 text-sm text-muted-foreground">
              Latest: {company.latest_procurement_date}
            </p>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">
            Intelligence changes
          </p>
          <p className="mt-1 text-lg font-semibold">
            {company.intelligence_change_count ?? 0}
          </p>

          <Link
            href={`/changes?entity=company&entityId=${company.company_id}`}
            className="mt-2 inline-block text-sm underline underline-offset-4"
          >
            View company changes
          </Link>
        </div>
      </div>

      {(company.company_type ||
        company.ownership_type ||
        company.data_confidence) && (
        <div className="rounded-xl border p-4">
          <h3 className="font-medium">Company classification</h3>

          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            {company.company_type && (
              <div>
                <dt className="text-sm text-muted-foreground">Type</dt>
                <dd className="mt-1">{company.company_type}</dd>
              </div>
            )}

            {company.ownership_type && (
              <div>
                <dt className="text-sm text-muted-foreground">Ownership</dt>
                <dd className="mt-1">{company.ownership_type}</dd>
              </div>
            )}

            {company.data_confidence && (
              <div>
                <dt className="text-sm text-muted-foreground">Confidence</dt>
                <dd className="mt-1">{company.data_confidence}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </section>
  );
}