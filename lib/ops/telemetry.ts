import { createClient } from "@/lib/supabase/server";
import { getCacheMeta, ageHoursSince } from "@/lib/atlas/tleCache";
import { readFile, appendFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Ops telemetry for /admin/ops.
 *
 * Everything here is read-only and cheap: the TLE cache is process-local
 * state, DB counts and freshness maxima are small aggregate queries, and
 * the TLE agent log is one small file read. The payload history is an
 * append-only JSONL file in the OS temp dir (process-local by design —
 * it records observations made by this server instance).
 */

export type CheckState = "ok" | "warn" | "fail" | "unknown";

export interface OpsSnapshot {
  tle: {
    state: CheckState;
    cached: boolean;
    count: number;
    ageHours: number | null;
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
    lastRun: string | null;
    lastRunAt: Date | null;
  };
  payload: {
    state: CheckState;
    mapKb: number | null;
    ms: number | null;
    error: string | null;
    /** Newest-to-oldest observations logged by this server process. */
    samples: { t: string; kb: number; ms: number }[];
    historyFile: string | null;
  };
  /** Pipeline freshness: latest created_at per ingested dataset vs budget. */
  freshness: FreshnessRow[];
}

export interface FreshnessRow {
  table: string;
  label: string;
  latestAt: string | null;
  ageHours: number | null;
  /** Hours after which this dataset is considered stale. */
  budgetHours: number;
  state: CheckState;
}

/** Compressed transfer size of a local page, plus timing. */
async function measurePage(path: string): Promise<{ bytes: number; ms: number } | null> {
  const url = `http://127.0.0.1:${process.env.PORT ?? 3000}${path}`;
  const started = performance.now();
  try {
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

const HISTORY_FILE = join(tmpdir(), "dip-ops-payload-history.jsonl");
const HISTORY_MAX_LINES = 60;

/** Append an observation and trim the file to the newest HISTORY_MAX_LINES. */
async function logPayloadSample(kb: number, ms: number): Promise<void> {
  try {
    await appendFile(HISTORY_FILE, `${JSON.stringify({ t: new Date().toISOString(), kb, ms })}\n`, "utf8");
    const raw = await readFile(HISTORY_FILE, "utf8").catch(() => "");
    const lines = raw.trim().split("\n").filter(Boolean);
    if (lines.length > HISTORY_MAX_LINES) {
      await writeFile(HISTORY_FILE, lines.slice(-HISTORY_MAX_LINES).join("\n") + "\n", "utf8");
    }
  } catch {
    // Telemetry must never break the page.
  }
}

async function readPayloadSamples(): Promise<{ t: string; kb: number; ms: number }[]> {
  try {
    const raw = await readFile(HISTORY_FILE, "utf8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines
      .slice(-HISTORY_MAX_LINES)
      .map((l) => JSON.parse(l) as { t: string; kb: number; ms: number })
      .reverse();
  } catch {
    return [];
  }
}

/** Newest "OK: refreshed TLE cache" line from the hourly agent's log. */
async function readTleAgentLog(): Promise<{ line: string | null; at: Date | null }> {
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

/*
 * Fallback staleness budgets per ingested dataset, in hours. The live values
 * live in the ops_freshness_budgets table (editable on /admin/ops); these
 * defaults apply when the table is missing, empty or unreadable. They reflect
 * the platform's actual refresh cadence (manual/weekly pipeline ingests),
 * not an aspirational SLA.
 */
const FRESHNESS_BUDGETS: { table: string; label: string; budgetHours: number }[] = [
  { table: "conflicts", label: "Conflicts (HIIK)", budgetHours: 72 },
  { table: "ingestion_queue", label: "Ingestion queue", budgetHours: 96 },
  { table: "budgets", label: "Budgets (SIPRI)", budgetHours: 336 },
  { table: "contracts", label: "Contracts", budgetHours: 840 },
  { table: "country_equipment", label: "Equipment holdings", budgetHours: 840 },
];

/** Load operator-editable budgets; fall back to the hardcoded defaults. */
async function loadFreshnessBudgets(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ table: string; label: string; budgetHours: number }[]> {
  const { data, error } = await supabase
    .from("ops_freshness_budgets")
    .select("dataset, label, budget_hours");
  if (error || !data || data.length === 0) return FRESHNESS_BUDGETS;
  return data.map((row) => ({
    table: String(row.dataset),
    label: String(row.label),
    budgetHours: Number(row.budget_hours),
  }));
}

export async function getOpsSnapshot(): Promise<OpsSnapshot> {
  const [meta, agent, page, supabase] = await Promise.all([
    Promise.resolve(getCacheMeta()),
    readTleAgentLog(),
    measurePage("/map"),
    createClient(),
  ]);

  const budgets = await loadFreshnessBudgets(supabase);

  const [countriesRes, conflictsRes, installationsRes, ...freshnessRes] = await Promise.all([
    supabase.from("countries").select("id", { count: "exact", head: true }),
    supabase.from("conflicts").select("id", { count: "exact", head: true }),
    supabase.from("military_installations").select("id", { count: "exact", head: true }),
    ...budgets.map((f) =>
      supabase.from(f.table).select("created_at").order("created_at", { ascending: false }).limit(1),
    ),
  ]);

  const dbError =
    countriesRes.error?.message ??
    conflictsRes.error?.message ??
    installationsRes.error?.message ??
    null;

  const ageHours = ageHoursSince(meta.timestamp);
  const tleState: CheckState = !meta.cached ? "fail" : (ageHours ?? 99) > 3 ? "warn" : "ok";

  const freshness: FreshnessRow[] = budgets.map((f, i) => {
    const row = freshnessRes[i]?.data?.[0] as { created_at: string | null } | undefined;
    const latestAt = row?.created_at ?? null;
    const age = latestAt != null ? ageHoursSince(new Date(latestAt).getTime()) : null;
    const state: CheckState =
      age == null ? "unknown" : age > f.budgetHours ? "warn" : "ok";
    return {
      table: f.table,
      label: f.label,
      latestAt,
      ageHours: age,
      budgetHours: f.budgetHours,
      state,
    };
  });

  let samples: { t: string; kb: number; ms: number }[] = [];
  if (page) {
    await logPayloadSample(Math.round(page.bytes / 1024), page.ms);
    samples = await readPayloadSamples();
  }

  return {
    tle: {
      state: tleState,
      cached: meta.cached,
      count: meta.count,
      ageHours,
      refreshedAt:
        meta.timestamp != null
          ? new Date(meta.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) +
            ", " +
            new Date(meta.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
          : null,
    },
    db: {
      state: dbError ? "fail" : countriesRes.count == null ? "unknown" : "ok",
      countries: countriesRes.count ?? null,
      conflicts: conflictsRes.count ?? null,
      installations: installationsRes.count ?? null,
      error: dbError,
    },
    agent: {
      state: !agent.at ? "unknown" : (Date.now() - agent.at.getTime()) / 3_600_000 > 2 ? "warn" : "ok",
      lastRun: agent.line,
      lastRunAt: agent.at,
    },
    payload: {
      state: !page ? "unknown" : page.bytes > 400_000 ? "warn" : "ok",
      mapKb: page ? Math.round(page.bytes / 1024) : null,
      ms: page?.ms ?? null,
      error: page ? null : "Could not reach the local server",
      samples,
      historyFile: HISTORY_FILE,
    },
    freshness,
  };
}
