import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess, AdminGate } from "@/lib/auth/adminAccess";

type ChangeRow = {
  id: number;
  entity_type: string | null;
  entity_id: number | null;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  change_date: string | null;
  data_confidence: string | null;
  importance: string | null;
  severity: string | null;
  summary: string | null;
  assessment: string | null;
  reviewed: boolean | null;
  source_title: string | null;
};

export default async function AdminPage() {
  const supabase = await createClient();

  const access = await getAdminAccess();
  if (!access.ok) {
    return <AdminGate reason={access.reason} redirectTo="/admin" />;
  }

  const { data, error } = await supabase
    .from("data_changes")
    .select(
      "id,entity_type,entity_id,field_name,old_value,new_value,change_date,data_confidence,importance,severity,summary,assessment,reviewed,source_title:sources(title)",
    )
    .order("changed_at", { ascending: false })
    .limit(50);

  const changes = (data || []) as unknown as ChangeRow[];

  return (
    <div className="w-full space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
          Platform
        </p>

        <h1 className="mt-2 text-4xl font-bold">
          Analyst Controls
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          Review intelligence records, provenance and data quality before
          changes become part of the public intelligence workflow.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="intel-surface p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
            Analyst
          </p>

          <p className="mt-3 text-xl font-semibold">
            {access.email}
          </p>

          <p className="mt-2 text-sm text-green-400">
            Analyst access active
          </p>
        </div>

        <div className="intel-surface p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
            Recent changes
          </p>

          <p className="mt-3 text-3xl font-bold">
            {changes.length}
          </p>
        </div>

        <div className="intel-surface p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
            Tools
          </p>

          <div className="mt-3 space-y-2 text-sm">
            <Link
              href="/intelligence"
              className="block text-sky-400 hover:text-sky-300"
            >
              Analyst Console →
            </Link>

            <Link
              href="/sources"
              className="block text-sky-400 hover:text-sky-300"
            >
              Source catalogue →
            </Link>

            <Link
              href="/changes"
              className="block text-sky-400 hover:text-sky-300"
            >
              Intelligence changes →
            </Link>
          </div>
        </div>
      </section>

      <section className="intel-surface overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-5">
          <h2 className="text-xl font-semibold">
            Recent records
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Review provenance and confidence before relying on a change.
          </p>
        </div>

        {error ? (
          <div className="p-6 text-sm text-red-300">
            {error.message}
          </div>
        ) : changes.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No records available.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="w-full min-w-225 text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/60">
                <tr>
                  <th className="px-5 py-4">Entity</th>
                  <th className="px-5 py-4">Field</th>
                  <th className="px-5 py-4">Change</th>
                  <th className="px-5 py-4">Confidence</th>
                  <th className="px-5 py-4">Importance</th>
                  <th className="px-5 py-4">Reviewed</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {changes.map((change) => (
                  <tr key={change.id}>
                    <td className="px-5 py-5">
                      <p className="font-medium">
                        {change.entity_type || "Entity"}
                      </p>

                      <p className="mt-1 text-xs text-slate-600">
                        #{change.entity_id}
                      </p>
                    </td>

                    <td className="px-5 py-5 text-slate-400">
                      {change.field_name || "—"}
                    </td>

                    <td className="max-w-[350px] px-5 py-5">
                      <p className="text-xs text-slate-500">
                        {change.old_value || "—"}
                      </p>

                      <p className="mt-1 text-sm text-slate-200">
                        → {change.new_value || "—"}
                      </p>
                    </td>

                    <td className="px-5 py-5">
                      {change.data_confidence || "Not assessed"}
                    </td>

                    <td className="px-5 py-5">
                      {change.importance || "Low"}
                    </td>

                    <td className="px-5 py-5">
                      {change.reviewed ? (
                        <span className="text-green-400">
                          Reviewed
                        </span>
                      ) : (
                        <span className="text-amber-400">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}