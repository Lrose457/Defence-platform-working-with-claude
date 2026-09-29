"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { csrfFetch } from "@/lib/security/csrfClient";

type Props = {
  changeId: number;
  sourceTitle?: string | null;
};

export default function AcceptSourceButton({
  changeId,
  sourceTitle,
}: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleAccept() {
    const sourceLabel = sourceTitle || "this source";

    const confirmed = window.confirm(
      `Accept all unreviewed intelligence changes from ${sourceLabel}?\n\n` +
        "This will mark every currently unreviewed intelligence change " +
        "from the same source as reviewed."
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await csrfFetch("/api/intelligence/changes/accept-source", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          changeId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || "Unable to accept changes from this source."
        );
      }

      setMessage(
        `${result.acceptedCount ?? 0} ${
          result.acceptedCount === 1 ? "entry" : "entries"
        } accepted.`
      );

      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to accept changes from this source."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleAccept}
        disabled={loading}
        className="inline-flex min-h-10 items-center justify-center rounded-md border border-emerald-800 bg-emerald-950/50 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-700 hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Accept all unreviewed entries from ${
          sourceTitle || "this source"
        }`}
      >
        {loading ? "Accepting…" : "Accept source"}
      </button>

      {message && (
        <p className="max-w-xs text-right text-xs leading-5 text-slate-500">
          {message}
        </p>
      )}
    </div>
  );
}