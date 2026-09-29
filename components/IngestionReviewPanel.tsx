"use client";

import { useMemo, useState } from "react";
import { csrfFetch } from "@/lib/security/csrfClient";

type ReviewQueueItem = {
  id: number;
  source_id: number | null;
  entity_type: string | null;
  entity_id: number | null;
  title: string | null;
  source_url: string | null;
  published_at: string | null;
  retrieved_at: string | null;
  verification_status: string | null;
  data_confidence: string | null;
  confidence_score: number | null;
  created_at: string | null;
  source?: {
    title?: string | null;
    publisher?: string | null;
  } | null;
};

type Props = {
  items: ReviewQueueItem[];
  sourceId: number | null;
  sourceTitle: string | null;
  sourcePublisher: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function IngestionReviewPanel({
  items,
  sourceId,
  sourceTitle,
  sourcePublisher,
}: Props) {
  const [pendingItems, setPendingItems] = useState(items);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedSourceLabel = useMemo(() => {
    if (sourceTitle) {
      return sourceTitle + (sourcePublisher ? ` — ${sourcePublisher}` : "");
    }

    return "Selected source";
  }, [sourceTitle, sourcePublisher]);

  async function handleDecision(decision: "approved" | "rejected" | "returned") {
    if (!sourceId) {
      setMessage("Select a source before reviewing records.");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const response = await csrfFetch("/api/intelligence/ingestion/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceId,
          decision,
          notes: notes.trim() || undefined,
        }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        approvedCount?: number;
        processedCount?: number;
      };

      if (!response.ok || result.error) {
        throw new Error(result.error || "Unable to record source review decision.");
      }

      const processedCount = result.processedCount ?? result.approvedCount ?? pendingItems.length;
      setPendingItems([]);
      setNotes("");
      setMessage(
        `${decision === "approved" ? "Approved" : decision === "rejected" ? "Rejected" : "Returned"} ${processedCount} pending record${processedCount === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to complete the review decision.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!sourceId || pendingItems.length === 0) {
    return (
      <section className="mt-8 rounded-2xl border border-slate-800 bg-[#071225] p-5 sm:p-7">
        <h2 className="text-lg font-semibold text-white">Source review</h2>
        <p className="mt-2 text-sm text-slate-500">
          Select a source from the ingestion overview to review and approve pending records.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-800 bg-[#071225] p-5 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Analyst mode
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">Review pending source records</h2>
          <p className="mt-2 text-sm text-slate-500">{selectedSourceLabel}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleDecision("approved")}
            disabled={busy}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:border-emerald-400/60 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Approve source
          </button>
          <button
            type="button"
            onClick={() => handleDecision("returned")}
            disabled={busy}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 hover:border-amber-400/60 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Return for review
          </button>
          <button
            type="button"
            onClick={() => handleDecision("rejected")}
            disabled={busy}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-300 hover:border-rose-400/60 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reject source
          </button>
        </div>
      </div>

      <label htmlFor="review-notes" className="mt-5 block text-sm font-medium text-slate-200">
        Review notes
      </label>
      <textarea
        id="review-notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={4}
        placeholder="Use this field to note why a source should be approved, returned, or rejected."
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 placeholder:text-slate-600"
      />

      {message && (
        <p className="mt-4 text-sm text-cyan-300">{message}</p>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <caption className="sr-only">Pending data ingestion records</caption>
          <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-3">Record</th>
              <th scope="col" className="px-3 py-3">Entity</th>
              <th scope="col" className="px-3 py-3">Source</th>
              <th scope="col" className="px-3 py-3">Confidence</th>
              <th scope="col" className="px-3 py-3">Retrieved</th>
              <th scope="col" className="px-3 py-3">URL</th>
            </tr>
          </thead>
          <tbody>
            {pendingItems.map((item) => (
              <tr key={item.id} className="border-b border-slate-800/70 last:border-0">
                <td className="px-3 py-4">
                  <div className="font-medium text-white">{item.title || "Untitled record"}</div>
                  <div className="mt-1 text-xs text-slate-500">#{item.id}</div>
                </td>
                <td className="px-3 py-4 text-slate-400">
                  {item.entity_type || "Unknown"}
                  {item.entity_id ? ` #${item.entity_id}` : ""}
                </td>
                <td className="px-3 py-4 text-slate-400">
                  {item.source?.title || sourceTitle || "Unknown source"}
                </td>
                <td className="px-3 py-4">
                  <div className="font-medium text-slate-200">
                    {item.data_confidence || "Not assessed"}
                  </div>
                  {typeof item.confidence_score === "number" && (
                    <div className="mt-1 text-xs text-slate-500">{item.confidence_score}%</div>
                  )}
                </td>
                <td className="px-3 py-4 text-slate-400">{formatDate(item.retrieved_at || item.created_at)}</td>
                <td className="px-3 py-4 text-slate-400">
                  {item.source_url ? (
                    <a href={item.source_url} target="_blank" rel="noreferrer" className="break-all text-cyan-300 hover:text-cyan-200 hover:underline">
                      Open source
                    </a>
                  ) : (
                    "No URL"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
