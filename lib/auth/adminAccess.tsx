import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * Shared analyst gate for /admin server components.
 *
 * One definition of "may open admin tooling": signed in AND holding the
 * `analyst` or `admin` role (same predicate the proxy enforces for /admin
 * routes — this helper adds defence in depth inside the page itself, which
 * the proxy cannot guarantee for server actions or future route groups).
 */

export type AdminAccess =
  | { ok: true; email: string | null }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

export async function getAdminAccess(): Promise<AdminAccess> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, reason: "unauthenticated" };
  }

  const { data: role } = await supabase
    .from("platform_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["analyst", "admin"])
    .maybeSingle();

  if (!role) {
    return { ok: false, reason: "forbidden" };
  }

  return { ok: true, email: user.email ?? null };
}

/** The two "no access" cards, shared so every admin page looks the same. */
export function AdminGate({
  reason,
  redirectTo = "/admin",
}: {
  reason: "unauthenticated" | "forbidden";
  redirectTo?: string;
}) {
  if (reason === "unauthenticated") {
    return (
      <div className="max-w-xl">
        <section className="intel-surface p-6">
          <h1 className="text-2xl font-semibold">Analyst access required</h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to access platform analyst tools.
          </p>
          <Link
            href={`/account/login?redirectTo=${encodeURIComponent(redirectTo)}`}
            className="mt-6 inline-flex rounded-lg bg-sky-400 px-5 py-2.5 text-sm font-semibold text-slate-950"
          >
            Sign in
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <section className="intel-surface border-amber-900 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-400">
          Restricted
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Analyst access required</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Your account does not have platform analyst permissions.
        </p>
      </section>
    </div>
  );
}
