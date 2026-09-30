import { createClient } from "@/lib/supabase/server";
import { getAdminAccess, AdminGate } from "@/lib/auth/adminAccess";
import { provenanceToneClass, scoreSourceProvenance } from "@/lib/provenance";

type DatasetQualityRow = {
  dataset: string;
  total_rows: number;
  missing_required_fields: number;
};

type SourceHealthRow = {
  id: string;
  name: string;
  health_status: string;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
};

export default async function DataQualityPage() {
  const access = await getAdminAccess();
  if (!access.ok) {
    return <AdminGate reason={access.reason} redirectTo="/admin/data-quality" />;
  }

  const supabase = await createClient();

  const [{ data: datasets }, { data: sourceHealth }] = await Promise.all([
    supabase
      .from("data_quality_summary")
      .select("*")
      .order("dataset"),

    supabase
      .from("ingestion_source_health")
      .select("*")
      .order("name"),
  ]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Administration
          </p>

          <h1 className="mt-2 text-3xl font-semibold">
            Data Quality
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Coverage, required-field completeness and ingestion-source
            health.
          </p>
        </div>

        <section>
          <h2 className="mb-4 text-lg font-semibold">
            Dataset quality
          </h2>

          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">
                    Dataset
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">
                    Rows
                  </th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">
                    Missing required
                  </th>
                </tr>
              </thead>

              <tbody>
                {(datasets ?? []).map((row: DatasetQualityRow) => (
                  <tr
                    key={row.dataset}
                    className="border-t border-slate-800"
                  >
                    <td className="px-4 py-3 text-slate-300">
                      {row.dataset}
                    </td>

                    <td className="px-4 py-3">
                      {Number(row.total_rows).toLocaleString()}
                    </td>

                    <td className="px-4 py-3 text-slate-400">
                      {Number(
                        row.missing_required_fields,
                      ).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">
            Ingestion sources
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            {(sourceHealth ?? []).map((source: SourceHealthRow) => {
              const provenance = scoreSourceProvenance({
                title: source.name,
                publisher: "Ingestion pipeline",
                url: source.last_success_at ? "https://ingestion.local" : null,
                source_type: "Ingestion",
                reliability: source.health_status === "healthy" ? "High" : source.health_status === "warning" ? "Medium" : "Low",
                notes: source.last_error || "No current ingestion error recorded.",
              });

              return (
                <div
                  key={source.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-medium">
                      {source.name}
                    </h3>

                    <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-wide ${provenanceToneClass(provenance.coverage)}`}>
                      {source.health_status}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-500">Provenance</span>
                    <span className="text-slate-300">{provenance.score}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-cyan-400" style={{ width: `${provenance.score}%` }} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-slate-600">Last checked</p>
                      <p className="mt-1 text-slate-400">
                        {source.last_checked_at || "Never"}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-600">Last success</p>
                      <p className="mt-1 text-slate-400">
                        {source.last_success_at || "Never"}
                      </p>
                    </div>
                  </div>

                  {source.last_error && (
                    <p className="mt-4 text-xs text-red-400">
                      {source.last_error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}