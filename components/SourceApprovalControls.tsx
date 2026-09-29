"use client";

import { useState } from "react";
import { csrfFetch } from "@/lib/security/csrfClient";

type Props = {
  sourceId: number;
  pendingCount: number;
  sourceTitle: string;
};

export default function SourceApprovalControls({
  sourceId,
  pendingCount,
  sourceTitle,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);

  async function approveSource() {
    const confirmed = window.confirm(
      `Approve all ${pendingCount.toLocaleString()} pending entries from "${sourceTitle}"?`,
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const response = await csrfFetch(
        "/api/intelligence/ingestion/review",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceId,
            decision: "approved",
            notes: `Bulk approved from source: ${sourceTitle}`,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Could not approve source entries.",
        );
      }

      setMessage(
        `Approved ${(result.approvedCount ?? 0).toLocaleString()} entries.`,
      );

      window.setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not approve source entries.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 lg:items-end">
      <button
        type="button"
        onClick={approveSource}
        disabled={busy || pendingCount === 0}
        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy
          ? "Approving…"
          : `Accept ${pendingCount.toLocaleString()} from source`}
      </button>

      {message && (
        <p
          role="status"
          className="text-xs text-emerald-400"
        >
          {message}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="max-w-sm text-xs text-red-400 lg:text-right"
        >
          {error}
        </p>
      )}
    </div>
  );
}