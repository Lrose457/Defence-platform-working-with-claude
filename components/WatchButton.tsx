"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/supabase";

type WatchButtonProps = {
  entityType: string;
  entityId: number;
  entityName: string;
};

export default function WatchButton({
  entityType,
  entityId,
  entityName,
}: WatchButtonProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadWatchState() {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (userError || !user) {
        setUserId(null);
        setWatching(false);
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from("user_watchlists")
        .select("id")
        .eq("user_id", user.id)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error("Watchlist lookup failed:", error);
        setMessage("Unable to load watchlist status.");
        setWatching(false);
      } else {
        setWatching(Boolean(data));
      }

      setLoading(false);
    }

    loadWatchState();

    return () => {
      active = false;
    };
  }, [entityType, entityId]);

  async function toggleWatch() {
    if (!userId) {
      setMessage("Sign in to use your watchlist.");
      return;
    }

    if (saving) return;

    setSaving(true);
    setMessage("");

    if (watching) {
      const { error } = await supabase
        .from("user_watchlists")
        .delete()
        .eq("user_id", userId)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId);

      if (error) {
        console.error("Watchlist delete failed:", error);
        setMessage(`Could not remove: ${error.message}`);
        setSaving(false);
        return;
      }

      setWatching(false);
      setMessage("Removed from watchlist.");
    } else {
      const { error } = await supabase
        .from("user_watchlists")
        .insert({
          user_id: userId,
          entity_type: entityType,
          entity_id: entityId,
          entity_name: entityName,
        });

      if (error) {
        console.error("Watchlist insert failed:", error);
        setMessage(`Could not add: ${error.message}`);
        setSaving(false);
        return;
      }

      setWatching(true);
      setMessage("Added to watchlist.");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <button
        type="button"
        disabled
        className="rounded-md border border-slate-800 px-4 py-2 text-sm text-slate-500"
      >
        Loading…
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggleWatch}
        disabled={saving}
        aria-pressed={watching}
        className={[
          "rounded-md border px-4 py-2 text-sm font-medium transition",
          watching
            ? "border-sky-700 bg-sky-950 text-sky-300 hover:bg-sky-900"
            : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800",
          saving ? "cursor-wait opacity-60" : "",
        ].join(" ")}
      >
        {saving
          ? "Saving…"
          : watching
            ? "✓ Watching"
            : "＋ Add to Watchlist"}
      </button>

      {message && (
        <p
          className="mt-2 max-w-sm text-xs text-slate-500"
          role="status"
        >
          {message}
        </p>
      )}
    </div>
  );
}