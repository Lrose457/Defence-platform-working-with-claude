"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl">
      <section className="intel-surface border-red-900 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-red-400">
          Application error
        </p>

        <h1 className="mt-2 text-2xl font-bold">
          Something went wrong
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          The platform could not complete this request. Your underlying
          intelligence data has not been changed by this error.
        </p>

        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-lg bg-sky-400 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-300"
        >
          Try again
        </button>
      </section>
    </div>
  );
}