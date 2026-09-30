import { createClient } from "@/lib/supabase/server";
import { getCacheMeta, ageHoursSince } from "@/lib/atlas/tleCache";
import { readFile } from "node:fs/promises";

/**
 * Ops telemetry for /admin/ops.
 *
 * Everything here is read-only and cheap: the TLE cache is process-local
 * state, DB counts are one aggregate query, and the TLE agent log is one
 * small file read. Nothing here is rendered into public pages.
 */

export type CheckState = "ok" | "warn" | "fail" | "unknown";

export interface OpsSnapshot {
  tle: {
    state: CheckState;
    cached: boolean;
    count: number;
    ageHours: number | null;
    /** e.g. "14:00, 30 Sep" — when the cache was last populated. */
    refreshedAt: string | null;
  };
  db: {
    state: CheckState;
    countries: number | null;
    conflicts: number | null;
    installations: number | null;
    error: string | null;
  };
  agent: {
    state: CheckState;
    /** Latest "refreshed TLE cache" line from the hourly agent's log. */
    lastRun: string | null;
    /** Local timestamp of the log line (agent runs on this host). */
    lastRunAt: Date | null;
  };
  payload: {
    state: CheckState;
    /** Compressed HTML transfer size of /map, in bytes. */
    mapKb: number | null;
    /** Wall-clock ms for the probe request. */
    ms: number | null;
    error: string | null;
  };
}

/** Compressed transfer size of a local page, plus timing. */
async function measurePage(path: string): Promise<{ bytes: number; ms: number } | null> {
  const url = `http://127.0.0.1:${process.env.PORT ?? 3000}${path}`;
  const started = performance.now();
  try {
    // Brotli/gzip-encoding keeps the measurement close to what a browser
    // actually downloads for an SSR page.
    const res = await fetch(url, {
      headers: { "accept-encoding": "gzip, br" },
      cache: "no-store",
    });
    const body = await res.arrayBuffer();
    return { bytes: body.byteLength, ms: Math.round(performance.now() - started) };
  } catch {
    return null;
  }
}

/** Newest "OK: refreshed TLE cache" line from the hourly agent's log. */
async function readTleAgentLog(): Promise<{ line: string | null; at: Date | null }> {
  // The LaunchAgent writes to /tmp/dip-tle-refresh.log on this host; the
  // dashboard just summarises the latest line. /tmp is readable here because
  // the app runs as the login user, not under a TCC-restricted context.
  try {
    const raw = await readFile("/tmp/dip-tle-refresh.log", "utf8");
    const lines = raw.trim().split("\n").filter(Boolean);
    const last = lines[lines.length - 1] ?? null;
    const match = last?.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
    return { line: last, at: match ? new Date(match[1]) : null };
  } catch {
    return { line: null, at: null };
  }
}

export async function getOpsSnapshot(): Promise<OpsSnapshot> {
  const [meta, agent, page, supabase] = await Promise.all([
    Promise.resolve(getCacheMeta()),
    readTleAgentLog(),
    measurePage("/map"),
    createClient(),
  ]);

  const { count: countries, error: countriesError } = await supabase
    .from("countries")
    .select("id", { count: "exact", head: true });
  const { count: conflicts, error: conflictsError } = await supabase
    .from("conflicts")
    .select("id", { count: "exact", head: true });
  const { count: installations, error: installationsError } = await supabase
    .from("military_installations")
    .select("id", { count: "exact", head: true });

  const dbError = countriesError?.message ?? conflictsError?.message ?? installationsError?.message ?? null;

  const ageHours = ageHoursSince(meta.timestamp);
  const tleState: CheckState = !meta.cached
    ? "fail"
    : (ageHours ?? 99) > 3
      ? "warn"
      : "ok";

  return {
    tle: {
      state: tleState,
      cached: meta.cached,
      count: meta.count,
      ageHours,
      refreshedAt:
        meta.timestamp != null
          ? new Date(meta.timestamp).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            }) + ", " + new Date(meta.timestamp).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            })
          : null,
    },
    db: {
      state: dbError ? "fail" : countries == null ? "unknown" : "ok",
      countries: countries ?? null,
      conflicts: conflicts ?? null,
      installations: installations ?? null,
      error: dbError,
    },
    agent: {
      // The agent is healthy if its last log line is fresh (< 2h); the
      // hourly schedule plus app-agent warm cache keep this tight.
      state: !agent.at
        ? "unknown"
        : (Date.now() - agent.at.getTime()) / 3_600_000 > 2
          ? "warn"
          : "ok",
      lastRun: agent.line,
      lastRunAt: agent.at,
    },
    payload: {
      state: !page ? "unknown" : page.bytes > 400_000 ? "warn" : "ok",
      mapKb: page ? Math.round(page.bytes / 1024) : null,
      ms: page?.ms ?? null,
      error: page ? null : "Could not reach the local server",
    },
  };
}
