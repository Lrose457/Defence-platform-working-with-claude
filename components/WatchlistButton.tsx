"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;

type WatchlistButtonProps = {
  entityType: string;
  entityId: number;
  entityName: string;
};

export default function WatchlistButton({
  entityType,
  entityId,
  entityName,
}: WatchlistButtonProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!supabase) {
        setUserId(null);
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        setUserId(null);
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data } = await supabase
        .from("user_watchlists")
        .select("id")
        .eq("user_id", user.id)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .maybeSingle();

      if (!mounted) return;

      setWatching(Boolean(data));
      setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, [entityType, entityId]);

  async function toggleWatchlist() {
    if (!supabase) {
      setMessage("Watchlist is unavailable.");
      return;
    }

    if (!userId) {
      setMessage("Sign in to use your watchlist.");
      return;
    }

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
        setMessage(error.message);
      } else {
        setWatching(false);
        setMessage("Removed from watchlist.");
      }
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
        setMessage(error.message);
      } else {
        setWatching(true);
        setMessage("Added to watchlist.");
      }
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
        onClick={toggleWatchlist}
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
        <p className="mt-2 text-xs text-slate-500" role="status">
          {message}
        </p>
      )}
    </div>
  );
}