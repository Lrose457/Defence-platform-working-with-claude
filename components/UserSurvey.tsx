"use client";

import React, { useState } from "react";

const ROLES = [
  "Journalist",
  "Academic / student",
  "Think-tank researcher",
  "Government / policy",
  "Industry",
  "OSINT / independent",
  "Personal interest",
];

const BENEFITS = [
  "Personal interest / learning",
  "Research or study",
  "Journalism / reporting",
  "Policy or procurement analysis",
  "Due diligence",
];

/**
 * Consent-gated, first-party survey (patch 0.2 doc: understand who users
 * are and what they get from the site). Deliberately minimal: no trackers,
 * no third-party analytics — answers are stored against the anonymous
 * search-session hash, never an IP, and submission is optional.
 */
export default function UserSurvey() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState("");
  const [organisationType, setOrganisationType] = useState("");
  const [benefit, setBenefit] = useState("");
  const [comments, setComments] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const csrfToken =
      document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ?? "";

    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ role, organisation_type: organisationType, benefit, comments }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDone(true);
    } catch {
      setError("Could not submit right now — please try again later.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded border border-green-900/50 bg-green-950/20 p-4 text-xs text-green-300">
        Thank you — your answer was recorded anonymously and helps shape the
        roadmap.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] text-slate-500 underline hover:text-slate-300"
      >
        What do you use this site for? (2 questions, anonymous)
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded border border-slate-800 bg-slate-900/50 p-4 text-xs"
    >
      <p className="font-semibold text-slate-200">
        Help shape the platform (optional &amp; anonymous)
      </p>
      <p className="text-[11px] leading-5 text-slate-500">
        Answers are stored without your IP, email or identity — nothing links
        them to you. Full details in the{" "}
        <a href="/privacy" className="intel-link">privacy notice</a>.
      </p>

      <label className="block">
        <span className="mb-1 block text-slate-400">Which best describes you?</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
          className="intel-select"
        >
          <option value="">Select…</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-slate-400">Biggest benefit you get from the site</span>
        <select
          value={benefit}
          onChange={(e) => setBenefit(e.target.value)}
          required
          className="intel-select"
        >
          <option value="">Select…</option>
          {BENEFITS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-slate-400">
          Organisation type (optional — e.g. &quot;national newspaper&quot;, &quot;university&quot;)
        </span>
        <input
          type="text"
          value={organisationType}
          onChange={(e) => setOrganisationType(e.target.value)}
          maxLength={120}
          className="intel-input"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-slate-400">Anything missing? (optional)</span>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          maxLength={1000}
          rows={3}
          className="intel-input"
        />
      </label>

      {error && <p className="text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded border border-blue-800 bg-blue-900/30 px-3 py-1.5 font-medium text-blue-200 hover:bg-blue-900/50 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Submit anonymously"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-slate-700 px-3 py-1.5 text-slate-400 hover:text-slate-200"
        >
          Not now
        </button>
      </div>
    </form>
  );
}
