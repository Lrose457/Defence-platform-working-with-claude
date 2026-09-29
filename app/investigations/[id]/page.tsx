import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RECORD_STATUS_COLOURS } from "@/lib/evidenceLevels";

interface InvestigationSummary {
  id: number;
  user_id: string;
  title: string;
  description: string | null;
  created_at: string;
  entity_count: number;
  source_count: number;
  note_count: number;
}

interface InvestigationItem {
  id: number;
  investigation_id: number;
  entity_type: string;
  entity_id: number | null;
  notes: string | null;
  created_at: string;
}

const ENTITY_TYPE_LABEL: Record<string, string> = {
  country: "Country",
  company: "Company",
  equipment: "Equipment",
  programme: "Programme",
  contract: "Contract",
  source: "Source",
  conflict: "Conflict",
};

const ENTITY_TYPE_ROUTE: Record<string, string> = {
  country: "countries",
  company: "companies",
  equipment: "equipment",
  programme: "programmes",
  contract: "contracts",
  source: "sources",
  conflict: "conflicts",
};

export default async function InvestigationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const investigationId = Number(id);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="min-h-screen bg-[#020817] px-4 py-10 text-slate-100">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-bold">Sign in required</h1>
          <p className="mt-4 text-slate-400">
            You must be signed in to view investigation details.
          </p>
          <Link
            href="/account/login"
            className="mt-6 inline-block rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  const [{ data: investigation }, { data: items }] = await Promise.all([
    supabase
      .from("investigation_workspace_summary")
      .select("*")
      .eq("id", investigationId)
      .eq("user_id", user.id)
      .maybeSingle<InvestigationSummary>(),

    supabase
      .from("investigation_workspace_items")
      .select("*")
      .eq("investigation_id", investigationId)
      .order("created_at", { ascending: false }),
  ]);

  if (!investigation) {
    return (
      <main className="min-h-screen bg-[#020817] px-4 py-10 text-slate-100">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/investigations"
            className="text-xs text-slate-500 hover:text-cyan-300"
          >
            ← Investigations
          </Link>

          <h1 className="mt-5 text-3xl font-bold text-white">
            Investigation not found
          </h1>

          <p className="mt-4 text-slate-400">
            The investigation you are looking for does not exist or you
            do not have access to it.
          </p>
        </div>
      </main>
    );
  }

  const investigationItems = (items ?? []) as InvestigationItem[];

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-7 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/investigations"
          className="text-xs text-slate-500 hover:text-cyan-300"
        >
          ← Investigations
        </Link>

        <header className="mt-5 mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Analyst workspace
          </p>

          <h1 className="mt-2 text-3xl font-bold text-white">
            {investigation.title}
          </h1>

          {investigation.description && (
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              {investigation.description}
            </p>
          )}

          <p className="mt-3 text-xs text-slate-600">
            Created {new Date(investigation.created_at).toLocaleDateString()}
          </p>
        </header>

        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-800 bg-[#071225] p-4">
            <div className="text-2xl font-bold text-white">
              {Number(investigation.entity_count || 0)}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">
              Entities
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#071225] p-4">
            <div className="text-2xl font-bold text-white">
              {Number(investigation.source_count || 0)}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">
              Sources
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#071225] p-4">
            <div className="text-2xl font-bold text-white">
              {Number(investigation.note_count || 0)}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">
              Notes
            </div>
          </div>
        </div>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-white">
            Tracked items
          </h2>

          {investigationItems.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-[#071225] p-6 text-center">
              <p className="text-sm text-slate-400">
                No items have been added to this investigation yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {investigationItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-800 bg-[#071225] p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                          RECORD_STATUS_COLOURS.live ??
                          "text-emerald-300 bg-emerald-500/10"
                        }`}
                      >
                        {ENTITY_TYPE_LABEL[item.entity_type] ??
                          item.entity_type}
                      </span>

                      {item.entity_id &&
                      ENTITY_TYPE_ROUTE[item.entity_type] ? (
                        <Link
                          href={`/${ENTITY_TYPE_ROUTE[item.entity_type]}/${item.entity_id}`}
                          className="text-sm font-medium text-cyan-300 hover:text-cyan-200"
                        >
                          #{item.entity_id}
                        </Link>
                      ) : (
                        <span className="text-sm text-slate-400">
                          #{item.entity_id ?? "—"}
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-600">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {item.notes && (
                    <p className="mt-2 text-sm text-slate-300">
                      {item.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-[#071225] p-6">
          <h2 className="mb-4 text-xl font-semibold text-white">
            Evidence level legend
          </h2>

          <div className="grid gap-2 text-xs text-slate-400">
            <p>
              <strong className="text-slate-300">Primary source</strong> —
              Directly from an official primary source document.
            </p>
            <p>
              <strong className="text-slate-300">Corroborated</strong> —
              Verified by two or more independent sources.
            </p>
            <p>
              <strong className="text-slate-300">Single source</strong> —
              From a single source, not yet cross-referenced.
            </p>
            <p>
              <strong className="text-slate-300">Inferred</strong> —
              Derived from analyst interpretation, not directly observed.
            </p>
            <p>
              <strong className="text-slate-300">Demonstration</strong> —
              Demo or test fixture data, not from live ingestion.
            </p>
            <p>
              <strong className="text-slate-300">Unverified</strong> —
              Reported but not yet assessed.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
