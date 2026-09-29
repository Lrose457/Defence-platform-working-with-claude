import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyExportLimit } from "@/lib/exportEntitlements";

/**
 * Organisation detail page.
 *
 * Shows the organisation's name, plan, member list, and current
 * export usage.  Only members of the organisation (or the owner)
 * can view this page.
 */

interface OrganisationMember {
  user_id: string;
  role: string;
  joined_at: string;
  email?: string;
}

export default async function OrganisationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-3xl font-bold text-white">
          Sign in required
        </h1>
        <p className="text-slate-400">
          You must be signed in to view organisation details.
        </p>
        <Link
          href="/account/login"
          className="inline-block rounded-lg bg-sky-400 px-5 py-2.5 text-sm font-semibold text-slate-950"
        >
          Sign in
        </Link>
      </div>
    );
  }

  /*
   * Verify the current user is a member of this organisation.
   */
  const { data: org, error: orgError } = await supabase
    .from("organisations")
    .select("id, name, slug, plan, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (orgError || !org) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-3xl font-bold text-white">
          Organisation not found
        </h1>
        <p className="text-slate-400">
          The organisation you are looking for does not exist.
        </p>
      </div>
    );
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organisation_members")
    .select("role")
    .eq("organisation_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-3xl font-bold text-white">
          Access denied
        </h1>
        <p className="text-slate-400">
          You are not a member of this organisation.
        </p>
      </div>
    );
  }

  /*
   * Fetch organisation members.
   */
  const { data: members } = await supabase
    .from("organisation_members")
    .select("user_id, role, joined_at")
    .eq("organisation_id", id)
    .order("joined_at", { ascending: true });

  const memberRows = (members ?? []) as OrganisationMember[];

  /*
   * Get the user's export limit based on their subscription plan.
   */
  const limit = await getMonthlyExportLimit(supabase, user.id);

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-7 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/account"
          className="text-xs text-slate-500 hover:text-cyan-300"
        >
          ← Account
        </Link>

        <header className="mt-5 mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Workspace
          </p>

          <h1 className="mt-2 text-3xl font-bold text-white">
            {org.name}
          </h1>

          <p className="mt-3 max-w-2xl text-sm text-slate-400">
            Plan: <span className="text-cyan-300">{org.plan}</span> •
            Created {new Date(org.created_at).toLocaleDateString()}
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-800 bg-[#071225] p-6">
            <h2 className="text-lg font-semibold text-white">
              Members
            </h2>

            <div className="mt-4 space-y-3">
              {memberRows.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between border-b border-slate-800 py-3 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      {member.user_id}
                    </p>
                    <p className="text-xs text-slate-500">
                      Joined{" "}
                      {new Date(member.joined_at).toLocaleDateString()}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-wide ${
                      member.role === "owner"
                        ? "bg-amber-500/10 text-amber-300 ring-amber-500/20"
                        : member.role === "admin"
                          ? "bg-cyan-500/10 text-cyan-300 ring-cyan-500/20"
                          : "bg-slate-500/10 text-slate-400 ring-slate-500/20"
                    }`}
                  >
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-[#071225] p-6">
            <h2 className="text-lg font-semibold text-white">
              Export allowance
            </h2>

            <p className="mt-4 text-sm text-slate-400">
              Current plan allows{" "}
              <span className="text-cyan-300 font-semibold">
                {limit.monthlyExports}
              </span>{" "}
              exports per month.
            </p>

            <Link
              href="/exports/usage"
              className="mt-2 inline-block text-sm text-cyan-400 hover:underline"
            >
              View usage →
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
