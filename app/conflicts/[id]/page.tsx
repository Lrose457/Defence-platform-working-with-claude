import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IntensityBadge, IntensityLegend } from "@/components/IntensityBadge";

type Props = {
  params: Promise<{ id: string }>;
};

type Incident = {
  id: number;
  incident_date: string | null;
  incident_type: string | null;
  importance: string | null;
  title: string;
  description: string | null;
  reported_outcome: string | null;
  military_impact: string | null;
  civilian_impact: string | null;
  data_confidence: string | null;
};

export default async function ConflictDetailPage({ params }: Props) {
  const { id } = await params;
  const conflictId = Number(id);

  if (!Number.isInteger(conflictId)) {
    notFound();
  }

  const supabase = await createClient();

  const [{ data: conflict }, { data: parties }, { data: incidents }] =
    await Promise.all([
      supabase
        .from("conflicts")
        .select("*")
        .eq("id", conflictId)
        .single(),

      supabase
        .from("conflict_parties")
        .select("*")
        .eq("conflict_id", conflictId)
        .order("party_name"),

      supabase
        .from("conflict_incidents")
        .select("*")
        .eq("conflict_id", conflictId)
        .order("incident_date", { ascending: false }),
    ]);

  if (!conflict) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/conflicts"
          className="text-sm text-slate-500 hover:text-slate-300"
        >
          ← Back to conflicts
        </Link>

        <div className="mt-6 border-b border-slate-800 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-400">
              {conflict.status || "Unknown status"}
            </span>

            <IntensityBadge level={(conflict as { intensity_level?: number | null }).intensity_level} />

            {conflict.region && (
              <span className="text-sm text-slate-500">
                {conflict.region}
              </span>
            )}
          </div>

          <h1 className="mt-4 text-3xl font-semibold">
            {conflict.name}
          </h1>

          {conflict.description && (
            <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-400">
              {conflict.description}
            </p>
          )}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="text-sm font-medium">Conflict metadata</h2>

              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Start date</dt>
                  <dd className="mt-1 text-slate-300">
                    {conflict.start_date || "Unknown"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-slate-500">End date</dt>
                  <dd className="mt-1 text-slate-300">
                    {conflict.end_date || "Ongoing"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-slate-500">
                    Data confidence
                  </dt>
                  <dd className="mt-1 text-slate-300">
                    {conflict.data_confidence || "Not specified"}
                  </dd>
                </div>
              </dl>

              <div className="mt-6">
                <IntensityLegend />
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="text-sm font-medium">Participants</h2>

              <div className="mt-4 space-y-3">
                {(parties ?? []).length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No participants recorded.
                  </p>
                ) : (
                  parties!.map((party) => (
                    <div
                      key={party.id}
                      className="border-b border-slate-800 pb-3 last:border-0"
                    >
                      <p className="text-sm text-slate-300">
                        {party.party_name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {[party.party_type, party.role]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>

          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">
                Incident timeline
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Reported incidents associated with this conflict.
              </p>
            </div>

            <div className="space-y-4">
              {(incidents ?? []).length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-500">
                  No incidents recorded.
                </div>
              ) : (
                incidents!.map((incident: Incident) => (
                  <article
                    key={incident.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <time className="text-xs text-slate-500">
                        {incident.incident_date}
                      </time>

                      {incident.incident_type && (
                        <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500">
                          {incident.incident_type}
                        </span>
                      )}

                      {incident.importance && (
                        <span className="text-[10px] uppercase tracking-wide text-slate-600">
                          {incident.importance}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-3 font-medium">
                      {incident.title}
                    </h3>

                    {incident.description && (
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {incident.description}
                      </p>
                    )}

                    {incident.reported_outcome && (
                      <div className="mt-4 rounded-lg bg-slate-950/70 p-4">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">
                          Reported outcome
                        </p>

                        <p className="mt-1 text-sm text-slate-300">
                          {incident.reported_outcome}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                      {incident.military_impact && (
                        <span>
                          Military impact: {incident.military_impact}
                        </span>
                      )}

                      {incident.civilian_impact && (
                        <span>
                          Civilian impact: {incident.civilian_impact}
                        </span>
                      )}

                      {incident.data_confidence && (
                        <span>
                          Confidence: {incident.data_confidence}
                        </span>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}