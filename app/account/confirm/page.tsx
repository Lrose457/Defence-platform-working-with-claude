import Link from "next/link";

export default function ConfirmPage() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--accent)">
          Account
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          Check your email
        </h1>

        <p className="mt-2 text-(--foreground-muted)">
          If email confirmation is enabled, Supabase has sent a
          confirmation message to your email address.
        </p>
      </header>

      <section className="intel-surface p-6">
        <p className="text-sm leading-6 text-(--foreground-muted)">
          Confirm your email address and then return to the platform to
          sign in.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/account/login"
            className="inline-flex min-h-11 items-center rounded-lg bg-(--accent) px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-(--accent-hover)"
          >
            Go to sign in
          </Link>

          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-700 px-5 py-2 text-sm font-medium hover:bg-slate-800"
          >
            Back to overview
          </Link>
        </div>
      </section>
    </div>
  );
}