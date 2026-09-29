import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type ExportRow = {
  id: number;
  export_type: string | null;
  format: string | null;
  status: string | null;
  row_count: number | null;
  created_at: string | null;
};

export default async function ExportsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let exportsList: ExportRow[] = [];
  let error: string | null = null;

  if (user) {
    const result = await supabase
      .from("exports")
      .select(
        "id,export_type,format,status,row_count,created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (result.error) {
      error = result.error.message;
    } else {
      exportsList = (result.data || []) as ExportRow[];
    }
  }

  return (
    <div className="w-full max-w-275 space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
          Workspace
        </p>

        <h1 className="mt-2 text-4xl font-bold">
          Exports
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          Download structured intelligence data for analysis and reporting.
        </p>
      </header>

      {!user ? (
        <section className="intel-surface p-6">
          <h2 className="text-xl font-semibold">
            Sign in to use exports
          </h2>

          <Link
            href="/account/login"
            className="mt-6 inline-flex rounded-lg bg-sky-400 px-5 py-2.5 text-sm font-semibold text-slate-950"
          >
            Sign in
          </Link>
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <Link
              href="/countries"
              className="intel-surface p-5 hover:border-slate-600"
            >
              <h2 className="font-semibold">
                Country data
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Country-level intelligence and spending.
              </p>
            </Link>

            <Link
              href="/compare"
              className="intel-surface p-5 hover:border-slate-600"
            >
              <h2 className="font-semibold">
                Comparisons
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Comparative defence spending datasets.
              </p>
            </Link>

            <Link
              href="/procurement"
              className="intel-surface p-5 hover:border-slate-600"
            >
              <h2 className="font-semibold">
                Procurement
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Procurement activity and contract information.
              </p>
            </Link>
          </section>

          <section className="intel-surface overflow-hidden">
            <div className="border-b border-slate-800 px-5 py-5">
              <h2 className="text-xl font-semibold">
                Export history
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Your recent generated exports.
              </p>
            </div>

            {error ? (
              <div className="p-6 text-sm text-red-300">
                {error}
              </div>
            ) : exportsList.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-medium">
                  No exports yet
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Generated exports will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {exportsList.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                  >
                    <div>
                      <p className="font-medium">
                        {item.export_type || "Data export"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {item.format?.toUpperCase() || "CSV"} ·{" "}
                        {item.row_count ?? "—"} rows
                      </p>
                    </div>

                    <div className="text-right text-xs text-slate-500">
                      <p>{item.status || "completed"}</p>

                      <p className="mt-1">
                        {item.created_at
                          ? new Intl.DateTimeFormat("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            }).format(new Date(item.created_at))
                          : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}