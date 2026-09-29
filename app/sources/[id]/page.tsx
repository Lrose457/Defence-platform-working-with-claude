import Link from "next/link";
import { notFound } from "next/navigation";
import { provenanceToneClass, scoreSourceProvenance } from "@/lib/provenance";
import { supabase } from "@/lib/supabase/supabase";

type Source = {
  id: number;
  title: string;
  publisher: string | null;
  url: string | null;
  publication_date: string | null;
  source_type: string | null;
  reliability: string | null;
  notes: string | null;
};

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;

  const id = Number(resolvedParams.id);

  if (!Number.isInteger(id)) {
    notFound();
  }

  const { data: source, error } = await supabase
    .from("sources")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !source) {
    notFound();
  }

  const typedSource = source as Source;
  const provenance = scoreSourceProvenance(typedSource);

  const { data: budgets } = await supabase
    .from("budgets")
    .select(
      "id,country_id,year,amount_usd,currency,budget_type,status"
    )
    .eq("source_id", id)
    .order("year", { ascending: false });

  const { data: contracts } = await supabase
    .from("contracts")
    .select(
      "id,title,value,status,country_id,company_id,programme_id"
    )
    .eq("source_id", id)
    .order("id", { ascending: false });

  const countryIds = [
    ...new Set(
      (budgets || [])
        .map((budget) => budget.country_id)
        .filter(Boolean)
    ),
  ];

  const { data: countries } =
    countryIds.length > 0
      ? await supabase
          .from("countries")
          .select("id,name")
          .in("id", countryIds)
      : { data: [] };

  const countryMap = new Map(
    (countries || []).map((country) => [
      country.id,
      country.name,
    ])
  );

  function formatMoney(value: number | null) {
    if (value === null || value === undefined) {
      return "Not recorded";
    }

    if (Math.abs(value) >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toFixed(1)}bn`;
    }

    if (Math.abs(value) >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}m`;
    }

    return `$${value.toLocaleString()}`;
  }

  return (
    <div className="intel-page space-y-8">
      {/* HEADER */}
      <div>
        <Link
          href="/sources"
          className="text-sm text-blue-400 hover:underline"
        >
          ← Back to Sources
        </Link>

        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
              Intelligence Evidence
            </p>

            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              {typedSource.title}
            </h1>

            <p className="mt-2 text-slate-400">
              {typedSource.publisher || "Publisher not recorded"}
            </p>
          </div>

          <span
            className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
              typedSource.reliability?.toLowerCase() === "high"
                ? "bg-emerald-500/10 text-emerald-400"
                : typedSource.reliability?.toLowerCase() === "low"
                ? "bg-red-500/10 text-red-400"
                : "bg-amber-500/10 text-amber-400"
            }`}
          >
            {typedSource.reliability || "Reliability not recorded"}
          </span>
        </div>
      </div>

      {/* OVERVIEW */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">
          Source overview
        </h2>

        <div className="intel-metrics md:grid-cols-2 lg:grid-cols-5">
          <div className="intel-metric">
            <p className="text-xs uppercase tracking-wider text-(--foreground-muted)">
              Publisher
            </p>
            <p className="mt-2 font-semibold">
              {typedSource.publisher || "Not recorded"}
            </p>
          </div>

          <div className="intel-metric">
            <p className="text-xs uppercase tracking-wider text-(--foreground-muted)">
              Type
            </p>
            <p className="mt-2 font-semibold">
              {typedSource.source_type || "Not recorded"}
            </p>
          </div>

          <div className="intel-metric">
            <p className="text-xs uppercase tracking-wider text-(--foreground-muted)">
              Publication date
            </p>
            <p className="mt-2 font-semibold">
              {typedSource.publication_date || "Not recorded"}
            </p>
          </div>

          <div className="intel-metric">
            <p className="text-xs uppercase tracking-wider text-(--foreground-muted)">
              Reliability
            </p>
            <p className="mt-2 font-semibold">
              {typedSource.reliability || "Not recorded"}
            </p>
          </div>

          <div className="intel-metric">
            <p className="text-xs uppercase tracking-wider text-(--foreground-muted)">
              Provenance health
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${provenanceToneClass(provenance.coverage)}`}>
                {provenance.coverage}
              </span>
              <span className="text-sm font-semibold text-slate-200">
                {provenance.score}%
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-(--border) bg-(--surface) p-6">
        <h2 className="text-lg font-semibold">Provenance coverage</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Title", present: provenance.checks.title },
            { label: "Publisher", present: provenance.checks.publisher },
            { label: "URL", present: provenance.checks.url },
            { label: "Source type", present: provenance.checks.sourceType },
            { label: "Reliability", present: provenance.checks.reliability },
            { label: "Notes", present: provenance.checks.notes },
          ].map(({ label, present }) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-lg border border-(--border) bg-slate-950/30 px-3 py-2 text-sm"
            >
              <span className="text-slate-300">{label}</span>
              <span className={present ? "text-emerald-400" : "text-amber-400"}>
                {present ? "Present" : "Missing"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* SOURCE LINK */}
      {typedSource.url && (
        <section className="rounded-xl border border-(--border) bg-(--surface) p-6">
          <h2 className="text-lg font-semibold">
            External source
          </h2>

          <p className="mt-2 text-sm text-(--foreground-muted)">
            Open the original publication or database.
          </p>

          <a
            href={typedSource.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block break-all text-sm text-blue-400 hover:underline"
          >
            {typedSource.url}
          </a>
        </section>
      )}

      {/* NOTES */}
      {typedSource.notes && (
        <section className="rounded-xl border border-(--border) bg-(--surface) p-6">
          <h2 className="text-lg font-semibold">
            Source assessment
          </h2>

          <p className="mt-3 text-sm leading-6 text-(--foreground-muted)">
            {typedSource.notes}
          </p>
        </section>
      )}

      {/* SPENDING */}
      <section>
        <div className="mb-4">
          <h2 className="text-2xl font-semibold">
            Spending records
          </h2>

          <p className="mt-1 text-sm text-(--foreground-muted)">
            Defence expenditure records currently linked to this source.
          </p>
        </div>

        <div className="table-scroll">
          <table className="intel-table">
            <caption className="sr-only">Spending records linked to this source</caption>
            <thead className="bg-(--surface)">
              <tr className="border-b border-(--border)">
                <th scope="col">Country</th>
                <th scope="col">Year</th>
                <th scope="col">Type</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
              </tr>
            </thead>

            <tbody>
              {(budgets || []).map((budget) => (
                <tr
                  key={budget.id}
                  className="border-b border-(--border) last:border-0"
                >
                  <td className="px-5 py-4">
                    {countryMap.get(budget.country_id) ||
                      "Unknown country"}
                  </td>

                  <td className="px-5 py-4">
                    {budget.year}
                  </td>

                  <td className="px-5 py-4 text-sm text-(--foreground-muted)">
                    {budget.budget_type || "Not recorded"}
                  </td>

                  <td className="px-5 py-4 font-medium">
                    {formatMoney(budget.amount_usd)}
                  </td>

                  <td className="px-5 py-4 text-sm text-(--foreground-muted)">
                    {budget.status || "Not recorded"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(!budgets || budgets.length === 0) && (
            <div className="p-6 text-sm text-(--foreground-muted)">
              No spending records are currently linked to this source.
            </div>
          )}
        </div>
      </section>

      {/* PROCUREMENT */}
      <section>
        <div className="mb-4">
          <h2 className="text-2xl font-semibold">
            Procurement records
          </h2>

          <p className="mt-1 text-sm text-(--foreground-muted)">
            Contracts currently linked to this source.
          </p>
        </div>

        <div className="space-y-3">
          {(contracts || []).map((contract) => (
            <Link
              key={contract.id}
              href={`/contracts/${contract.id}`}
              className="block rounded-xl border border-(--border) bg-(--surface) p-5 hover:border-blue-500"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">
                    {contract.title || "Untitled contract"}
                  </p>

                  <p className="mt-1 text-sm text-(--foreground-muted)">
                    {contract.status || "Status not recorded"}
                  </p>
                </div>

                <p className="font-semibold">
                  {formatMoney(contract.value)}
                </p>
              </div>
            </Link>
          ))}

          {(!contracts || contracts.length === 0) && (
            <div className="rounded-xl border border-(--border) bg-(--surface) p-6 text-sm text-(--foreground-muted)">
              No procurement records are currently linked to this
              source.
            </div>
          )}
        </div>
      </section>

      {/* METHODOLOGY */}
      <section className="rounded-xl border border-(--border) bg-(--surface) p-6">
        <h2 className="text-lg font-semibold">
          Evidence context
        </h2>

        <p className="mt-3 text-sm leading-6 text-(--foreground-muted)">
          A source link indicates that the record is supported by this
          source in the platform. Source reliability and record
          confidence are separate assessments and should be considered
          together when evaluating an intelligence record.
        </p>
      </section>
    </div>
  );
}
