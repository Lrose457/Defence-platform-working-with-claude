import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl">
      <section className="intel-surface p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
          404
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          Intelligence record not found
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          The requested page or record does not exist, or is no longer
          available at this address.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg bg-sky-400 px-5 py-2.5 text-sm font-semibold text-slate-950"
          >
            Overview
          </Link>

          <Link
            href="/search"
            className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm hover:bg-slate-800"
          >
            Global Search
          </Link>
        </div>
      </section>
    </div>
  );
}