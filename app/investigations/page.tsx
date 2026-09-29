import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Investigation = {
  id: number;
  title: string;
  description: string | null;
  created_at: string;
  entity_count: number | string;
  source_count: number | string;
  note_count: number | string;
};

export default async function InvestigationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="min-h-screen bg-[#020817] px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-800 bg-[#071225] p-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Analyst workspace
          </p>

          <h1 className="mt-2 text-3xl font-semibold">
            Investigations
          </h1>

          <p className="mt-3 text-sm text-slate-400">
            Sign in to create and manage analyst investigations.
          </p>

          <Link
            href="/account/login"
            className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-cyan-400 px-5 text-sm font-semibold text-slate-950"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  const { data } = await supabase
    .from("investigation_workspace_summary")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const investigations = (data || []) as Investigation[];

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-7 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Analyst workspace
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Investigations
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Build structured research around entities, sources and
              intelligence changes.
            </p>
          </div>

          <Link
            href="/intelligence/new"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
          >
            New investigation
          </Link>
        </header>

        {investigations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-[#071225] px-6 py-16 text-center">
            <h2 className="text-lg font-semibold text-white">
              No investigations yet
            </h2>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Create an investigation to organise entities, evidence,
              sources and analyst notes around a specific question.
            </p>

            <Link
              href="/intelligence/new"
              className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-cyan-400 px-5 text-sm font-semibold text-slate-950"
            >
              Create investigation
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {investigations.map((investigation) => (
              <Link
                key={investigation.id}
                href={`/investigations/${investigation.id}`}
                className="group rounded-2xl border border-slate-800 bg-[#071225] p-5 shadow-lg transition hover:-translate-y-0.5 hover:border-slate-700 hover:bg-[#09172b] focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-white group-hover:text-cyan-300">
                      {investigation.title}
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      Created{" "}
                      {new Date(
                        investigation.created_at,
                      ).toLocaleDateString()}
                    </p>
                  </div>

                  <span className="text-slate-600 transition group-hover:text-cyan-400">
                    →
                  </span>
                </div>

                {investigation.description && (
                  <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-400">
                    {investigation.description}
                  </p>
                )}

                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-800 pt-4">
                  <div>
                    <div className="text-lg font-semibold text-white">
                      {Number(investigation.entity_count || 0)}
                    </div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-600">
                      Entities
                    </div>
                  </div>

                  <div>
                    <div className="text-lg font-semibold text-white">
                      {Number(investigation.source_count || 0)}
                    </div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-600">
                      Sources
                    </div>
                  </div>

                  <div>
                    <div className="text-lg font-semibold text-white">
                      {Number(investigation.note_count || 0)}
                    </div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-600">
                      Notes
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}