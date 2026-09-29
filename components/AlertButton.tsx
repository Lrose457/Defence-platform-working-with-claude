"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/supabase";

type AlertButtonProps = {
  entityType: string;
  entityId: number;
  entityName: string;
};

const thresholds = [
  {
    value: "low",
    label: "Low and above",
  },
  {
    value: "medium",
    label: "Medium and above",
  },
  {
    value: "high",
    label: "High only",
  },
];

export default function AlertButton({
  entityType,
  entityId,
  entityName,
}: AlertButtonProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [alertId, setAlertId] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState("medium");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAlert() {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (userError || !user) {
        setUserId(null);
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from("user_alerts")
        .select("id, enabled, importance_threshold")
        .eq("user_id", user.id)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error("Alert lookup failed:", error);
        setMessage(`Unable to load alert: ${error.message}`);
        setLoading(false);
        return;
      }

      if (data) {
        setAlertId(data.id);
        setEnabled(Boolean(data.enabled));
        setThreshold(data.importance_threshold ?? "medium");
      } else {
        setAlertId(null);
        setEnabled(false);
        setThreshold("medium");
      }

      setLoading(false);
    }

    loadAlert();

    return () => {
      active = false;
    };
  }, [entityType, entityId]);

  async function createAlert() {
    if (!userId) {
      setMessage("Sign in to create alerts.");
      return;
    }

    if (saving) return;

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("user_alerts")
      .insert({
        user_id: userId,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        alert_type: "change",
        enabled: true,
        importance_threshold: threshold,
      })
      .select("id, enabled, importance_threshold")
      .single();

    if (error) {
      console.error("Alert creation failed:", error);
      setMessage(`Could not create alert: ${error.message}`);
      setSaving(false);
      return;
    }

    setAlertId(data.id);
    setEnabled(Boolean(data.enabled));
    setThreshold(data.importance_threshold ?? threshold);
    setMessage("Alert created.");

    setSaving(false);
  }

  async function updateThreshold(value: string) {
    setThreshold(value);

    if (!alertId || !userId) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("user_alerts")
      .update({
        importance_threshold: value,
      })
      .eq("id", alertId)
      .eq("user_id", userId);

    if (error) {
      console.error("Alert threshold update failed:", error);
      setMessage(`Could not update alert: ${error.message}`);
    } else {
      setMessage("Alert threshold updated.");
    }

    setSaving(false);
  }

  async function toggleAlert() {
    if (!alertId || !userId || saving) return;

    setSaving(true);
    setMessage("");

    const nextEnabled = !enabled;

    const { error } = await supabase
      .from("user_alerts")
      .update({
        enabled: nextEnabled,
      })
      .eq("id", alertId)
      .eq("user_id", userId);

    if (error) {
      console.error("Alert toggle failed:", error);
      setMessage(`Could not update alert: ${error.message}`);
    } else {
      setEnabled(nextEnabled);
      setMessage(nextEnabled ? "Alert enabled." : "Alert disabled.");
    }

    setSaving(false);
  }

  async function deleteAlert() {
    if (!alertId || !userId || saving) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("user_alerts")
      .delete()
      .eq("id", alertId)
      .eq("user_id", userId);

    if (error) {
      console.error("Alert deletion failed:", error);
      setMessage(`Could not remove alert: ${error.message}`);
    } else {
      setAlertId(null);
      setEnabled(false);
      setThreshold("medium");
      setMessage("Alert removed.");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="rounded-md border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-500">
        Loading alert settings…
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="rounded-md border border-slate-800 bg-slate-950 p-4">
        <p className="text-sm font-medium text-slate-200">
          Change alerts
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          Sign in to receive alerts when this record changes.
        </p>
      </div>
    );
  }

  if (!alertId) {
    return (
      <div className="rounded-md border border-slate-800 bg-slate-950 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-200">
              Change alerts
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Create an alert when new intelligence changes are recorded for
              this {entityType}.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="text-xs text-slate-500">
              <span className="block mb-1">Importance</span>

              <select
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
                className="min-h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
              >
                {thresholds.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={createAlert}
              disabled={saving}
              className="min-h-10 rounded-md border border-sky-700 bg-sky-950 px-4 py-2 text-sm font-medium text-sky-300 transition hover:bg-sky-900 disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create Alert"}
            </button>
          </div>
        </div>

        {message && (
          <p
            className="mt-3 text-xs text-slate-500"
            role="status"
          >
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-800 bg-slate-950 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-200">
              Change alert
            </p>

            <span
              className={
                enabled
                  ? "rounded-full border border-emerald-800 bg-emerald-950/40 px-2 py-0.5 text-[11px] text-emerald-300"
                  : "rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-500"
              }
            >
              {enabled ? "Active" : "Disabled"}
            </span>
          </div>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {enabled
              ? "This record is being monitored for recorded intelligence changes."
              : "This alert is currently disabled."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`alert-threshold-${entityId}`}>
            Alert importance threshold
          </label>

          <select
            id={`alert-threshold-${entityId}`}
            value={threshold}
            onChange={(event) => updateThreshold(event.target.value)}
            disabled={saving}
            className="min-h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 disabled:opacity-60"
          >
            {thresholds.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={toggleAlert}
            disabled={saving}
            className="min-h-10 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
          >
            {enabled ? "Disable" : "Enable"}
          </button>

          <button
            type="button"
            onClick={deleteAlert}
            disabled={saving}
            className="min-h-10 rounded-md border border-red-900 px-3 py-2 text-sm text-red-400 transition hover:bg-red-950 disabled:opacity-60"
          >
            Remove
          </button>
        </div>
      </div>

      {message && (
        <p
          className="mt-3 text-xs text-slate-500"
          role="status"
        >
          {message}
        </p>
      )}
    </div>
  );
}