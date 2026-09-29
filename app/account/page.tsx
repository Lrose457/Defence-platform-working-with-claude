import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Organisation = {
  id: number;
  name: string;
  slug: string | null;
  created_at: string | null;
};

type OrganisationMemberRow = {
  organisations: Organisation | Organisation[] | null;
};

export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  let organisations: Organisation[] = [];
  let organisationError: string | null = null;

  if (user) {
    const result = await supabase
      .from("organisation_members")
      .select(
        `
          organisation_id,
          organisations (
            id,
            name,
            slug,
            created_at
          )
        `,
      )
      .eq("user_id", user.id);

    if (result.error) {
      organisationError = result.error.message;
    } else {
      organisations = (result.data || [])
        .map((row: OrganisationMemberRow) => row.organisations)
        .map((organisation) =>
          Array.isArray(organisation) ? organisation[0] : organisation,
        )
        .filter(Boolean) as Organisation[];
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Account Management</h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Research Workspace & Access Control
          </p>
        </div>
      </div>

      {authError ? (
        <section className="p-4 rounded border border-red-900 bg-red-950/20">
          <h2 className="text-sm font-bold uppercase tracking-widest text-red-400">System Error</h2>
          <p className="mt-2 text-xs font-mono text-red-300">
            {authError.message}
          </p>
        </section>
      ) : !user ? (
        <section className="p-6 rounded border border-slate-800 bg-slate-900/50 text-center space-y-4">
          <h2 className="text-lg font-semibold text-slate-200">User Not Authenticated</h2>
          <p className="text-xs text-slate-500 font-mono">SIGN_IN_REQUIRED to access personal workspace.</p>
          <Link
            href="/account/login"
            className="inline-flex px-4 py-2 rounded bg-blue-600 text-white text-xs font-bold uppercase tracking-tighter hover:bg-blue-500 transition-colors"
          >
            Authenticate
          </Link>
        </section>
      ) : (
        <>
          {/* Account status */}
          <section className="p-4 rounded border border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-6">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-green-500">Identity Verified</p>
              <h2 className="text-lg font-mono text-slate-200">{user.email}</h2>
              <p className="text-xs text-slate-500 font-mono">STATUS: ACTIVE_RESEARCHER</p>
            </div>

            <form action="/account/signout" method="post">
              <button
                type="submit"
                className="px-3 py-1.5 rounded border border-slate-700 text-xs font-mono text-slate-400 hover:bg-slate-800 transition-colors"
              >
                SIGN_OUT
              </button>
            </form>
          </section>

          {/* Organisations */}
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">Workspace Access</h2>
                <p className="text-xs text-slate-500 font-mono">Shared research and commercial environments.</p>
              </div>
              <Link
                href="/account/organisation/new"
                className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-bold uppercase tracking-tighter hover:bg-blue-500 transition-colors"
              >
                Create Organisation
              </Link>
            </div>

            {organisationError ? (
              <div className="p-3 rounded border border-red-900 bg-red-950/20 text-xs font-mono text-red-300">
                {organisationError}
              </div>
            ) : organisations.length === 0 ? (
              <div className="p-6 rounded border border-slate-800 bg-slate-950 text-center">
                <p className="text-xs font-mono text-slate-500 uppercase">No organisation linked to this identity</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {organisations.map((organisation) => (
                  <Link
                    key={organisation.id}
                    href={`/account/organisation/${organisation.id}`}
                    className="p-4 rounded border border-slate-800 bg-slate-900/50 transition hover:border-blue-600 group"
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-slate-200 group-hover:text-blue-400 transition-colors">
                        {organisation.name}
                      </h3>
                      <span className="text-[10px] font-mono text-slate-600">
                        {organisation.slug || 'NO_SLUG'}
                      </span>
                    </div>
                    <p className="mt-3 text-[10px] font-mono text-blue-500 uppercase tracking-widest">
                      Access Workspace &rarr;
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Personal research */}
          <div className="grid gap-4 md:grid-cols-2">
            <Link
              href="/watchlist"
              className="p-4 rounded border border-slate-800 bg-slate-900/50 hover:border-blue-600 transition-all group"
            >
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300 group-hover:text-blue-400 transition-colors">
                Watchlist
              </h2>
              <p className="mt-1 text-xs text-slate-500 font-mono">Track specific entities and alerts.</p>
            </Link>

            <Link
              href="/investigations"
              className="p-4 rounded border border-slate-800 bg-slate-900/50 hover:border-blue-600 transition-all group"
            >
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300 group-hover:text-blue-400 transition-colors">
                Investigations
              </h2>
              <p className="mt-1 text-xs text-slate-500 font-mono">Access saved research paths.</p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
