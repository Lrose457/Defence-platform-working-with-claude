"use client";

import { FormEvent, useState } from "react";

export default function OptOutPage() {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const csrfToken =
      document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ?? "";
    const response = await fetch("/api/opt-out", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const result = await response.json();
    setMessage(response.ok ? "Your request has been recorded for review." : result.error || "Unable to submit request.");
    setSubmitting(false);
    if (response.ok) event.currentTarget.reset();
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">Privacy rights</p>
        <h1 className="mt-2 text-4xl font-bold">Opt out and request suppression</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">Use this form to request suppression or deletion of personal data from aggregated search results. We may request reasonable proof of identity to prevent fraudulent requests.</p>
      </header>
      <form onSubmit={submit} className="intel-surface space-y-5 p-6">
        <label className="block text-sm">Name<input required name="name" className="mt-2 w-full rounded border border-slate-700 bg-slate-950 p-3" /></label>
        <label className="block text-sm">Contact email<input required type="email" name="email" className="mt-2 w-full rounded border border-slate-700 bg-slate-950 p-3" /></label>
        <label className="block text-sm">What should be suppressed?<textarea required name="details" rows={6} className="mt-2 w-full rounded border border-slate-700 bg-slate-950 p-3" /></label>
        <button disabled={submitting} className="rounded bg-sky-400 px-5 py-3 font-semibold text-slate-950">{submitting ? "Submitting…" : "Submit request"}</button>
        {message && <p role="status" className="text-sm text-slate-300">{message}</p>}
      </form>
    </main>
  );
}
