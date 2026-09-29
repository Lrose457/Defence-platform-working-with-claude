import Link from "next/link";
import { provenanceToneClass, scoreSourceProvenance } from "@/lib/provenance";
import { createClient } from "@/lib/supabase/server";

type Quality = {
  countries: number;
  companies: number;
  equipment: number;
  programmes: number;
  contracts: number;
  budgets: number;
  sources: number;
  procurement_events: number;
  data_changes: number;
  intelligence_changes: number;
  sources_without_url: number;
  budgets_without_source: number;
  contracts_without_source: number;
  procurement_events_without_source: number;
};

export default async function AdminHealthPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("production_data_quality_summary_v2")
    .select("*")
    .single();

  const quality = data as Quality | null;

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-7 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin"
          className="text-xs text-slate-500 hover:text-cyan-300"
        >
          ← Admin
        </Link>

        <header className="mt-5 mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Platform operations
          </p>

          <h1 className="mt-2 text-3xl font-semibold text-white">
            Production health
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            High-level checks for data coverage and source provenance.
          </p>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-300">
            {error.message}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Countries"
            value={quality?.countries ?? 0}
          />

          <Metric
            label="Companies"
            value={quality?.companies ?? 0}
          />

          <Metric
            label="Equipment"
            value={quality?.equipment ?? 0}
          />

          <Metric
            label="Programmes"
            value={quality?.programmes ?? 0}
          />

          <Metric
            label="Contracts"
            value={quality?.contracts ?? 0}
          />

          <Metric
            label="Budgets"
            value={quality?.budgets ?? 0}
          />

          <Metric
            label="Sources"
            value={quality?.sources ?? 0}
          />

          <Metric
            label="Data changes"
            value={quality?.data_changes ?? 0}
          />
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-[#071225] p-6">
          <h2 className="text-lg font-semibold text-white">
            Source coverage
          </h2>

          <div className="mt-5 space-y-3">
            <QualityRow
              label="Sources without URL"
              value={quality?.sources_without_url ?? 0}
            />

            <QualityRow
              label="Budgets without source"
              value={quality?.budgets_without_source ?? 0}
            />

            <QualityRow
              label="Contracts without source"
              value={quality?.contracts_without_source ?? 0}
            />

            <QualityRow
              label="Procurement events without source"
              value={quality?.procurement_events_without_source ?? 0}
            />
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-[#071225] p-6">
          <h2 className="text-lg font-semibold text-white">
            Provenance readiness
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              { title: "USAspending", publisher: "US government", url: "https://www.usaspending.gov/", source_type: "Procurement", reliability: "High", notes: "Public API with attribution." },
              { title: "OFAC Sanctions", publisher: "US Treasury", url: "https://ofac.treasury.gov/", source_type: "Ownership and sanctions", reliability: "High", notes: "Public sanctions list." },
              { title: "OpenSanctions", publisher: "OpenSanctions", url: "https://www.opensanctions.org/", source_type: "Ownership and sanctions", reliability: "High", notes: "API or licensed dataset." },
            ].map((source) => {
              const provenance = scoreSourceProvenance(source);

              return (
                <div key={source.title} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-100">{source.title}</p>
                      <p className="text-xs text-slate-500">{source.publisher}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${provenanceToneClass(provenance.coverage)}`}>
                      {provenance.coverage}
                    </span>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-cyan-400" style={{ width: `${provenance.score}%` }} />
                  </div>

                  <p className="mt-2 text-xs text-slate-400">{provenance.score}% complete</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <Link
            href="/admin/data-quality"
            className="rounded-2xl border border-slate-800 bg-[#071225] p-5 hover:border-cyan-400/30"
          >
            <h2 className="font-semibold text-white">
              Data quality
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Review existing quality checks.
            </p>
          </Link>

          <Link
            href="/admin/ingestion"
            className="rounded-2xl border border-slate-800 bg-[#071225] p-5 hover:border-cyan-400/30"
          >
            <h2 className="font-semibold text-white">
              Ingestion
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Review the source ingestion pipeline.
            </p>
          </Link>

          <Link
            href="/sources"
            className="rounded-2xl border border-slate-800 bg-[#071225] p-5 hover:border-cyan-400/30"
          >
            <h2 className="font-semibold text-white">
              Sources
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Inspect source provenance.
            </p>
          </Link>
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#071225] p-5">
      <div className="text-xs uppercase tracking-wider text-slate-600">
        {label}
      </div>

      <div className="mt-3 text-3xl font-semibold text-white">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function QualityRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800/70 py-3 last:border-0">
      <span className="text-sm text-slate-400">
        {label}
      </span>

      <span
        className={
          value === 0
            ? "text-sm font-semibold text-emerald-300"
            : "text-sm font-semibold text-amber-300"
        }
      >
        {value.toLocaleString()}
      </span>
    </div>
  );
}