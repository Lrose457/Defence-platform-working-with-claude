"use client";

import { useState } from "react";
import { csrfFetch } from "@/lib/security/csrfClient";

type ReviewDecision = "approved" | "rejected" | "returned";

type Props = {
  queueId: number;
  currentStatus?: string | null;
};

export default function IngestionReviewControls({
  queueId,
  currentStatus,
}: Props) {
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submitReview(
    decision: ReviewDecision,
  ) {
    setSaving(true);
    setMessage("");

    try {
      const response = await csrfFetch(
        "/api/intelligence/ingestion/review",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            queueId,
            decision,
            notes,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Review could not be saved.",
        );
      }

      setMessage(
        `Record marked as ${decision}. Refresh to view the updated status.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Review could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (
    currentStatus === "approved" ||
    currentStatus === "rejected"
  ) {
    return (
      <p className="text-sm text-slate-400">
        This record has already been {currentStatus}.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor={`review-notes-${queueId}`}
        className="block text-sm font-medium text-slate-300"
      >
        Review notes
      </label>

      <textarea
        id={`review-notes-${queueId}`}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Explain the review decision..."
        rows={3}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => submitReview("approved")}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Approve
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => submitReview("returned")}
          className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Return
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => submitReview("rejected")}
          className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reject
        </button>
      </div>

      {message && (
        <p
          role="status"
          className="text-sm text-slate-400"
        >
          {message}
        </p>
      )}
    </div>
  );
}