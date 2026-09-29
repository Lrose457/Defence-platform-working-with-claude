/**
 * Evidence-level taxonomy for the Defence Intelligence Platform.
 *
 * Every intelligence record is tagged with an evidence level that
 * communicates how it was sourced, verified, and corroborated.
 * This taxonomy is used across the platform — in the API, the UI,
 * and the data pipeline — to ensure consumers understand the
 * confidence and limitations of each piece of intelligence.
 */

/**
 * The strength of evidence backing an intelligence record.
 */
export type EvidenceLevel =
  | "primary_source" // Directly from an official primary source (e.g. government budget document)
  | "corroborated" // Verified by 2+ independent sources
  | "single_source" // From a single source, not yet cross-referenced
  | "inferred" // Derived from analysis, not directly observed
  | "demonstration" // Demo / test fixture data, not from live ingestion
  | "unverified"; // Reported but not yet assessed

/**
 * The lifecycle state of an intelligence record.
 */
export type RecordStatus =
  | "live" // Actively maintained, updated from live sources
  | "partial" // Populated from a subset of sources or historical import
  | "published" // Curated, reviewed, and published to the public feed
  | "demo" // Demo / test fixture data
  | "archived" // Superseded by newer data
  | "suppressed" // Withheld pending review or legal concern;

/**
 * Metadata about an intelligence record's provenance.
 */
export type EvidenceMetadata = {
  level: EvidenceLevel;
  status: RecordStatus;
  sourceCount: number;
  lastVerifiedAt: string | null;
  confidenceScore: number; // 0–100
};

/**
 * Human-readable labels for evidence levels.
 */
export const EVIDENCE_LEVEL_LABELS: Record<EvidenceLevel, string> = {
  primary_source: "Primary source",
  corroborated: "Corroborated",
  single_source: "Single source",
  inferred: "Inferred",
  demonstration: "Demonstration",
  unverified: "Unverified",
};

/**
 * Human-readable labels for record statuses.
 */
export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  live: "Live",
  partial: "Partial",
  published: "Published",
  demo: "Demo",
  archived: "Archived",
  suppressed: "Suppressed",
};

/**
 * Tailwind colour classes for evidence levels.
 */
export const EVIDENCE_LEVEL_COLOURS: Record<EvidenceLevel, string> = {
  primary_source: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/20",
  corroborated: "text-cyan-300 bg-cyan-500/10 ring-cyan-500/20",
  single_source: "text-amber-300 bg-amber-500/10 ring-amber-500/20",
  inferred: "text-slate-400 bg-slate-500/10 ring-slate-500/20",
  demonstration: "text-purple-300 bg-purple-500/10 ring-purple-500/20",
  unverified: "text-rose-300 bg-rose-500/10 ring-rose-500/20",
};

/**
 * Tailwind colour classes for record statuses.
 */
export const RECORD_STATUS_COLOURS: Record<RecordStatus, string> = {
  live: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/20",
  partial: "text-amber-300 bg-amber-500/10 ring-amber-500/20",
  published: "text-sky-300 bg-sky-500/10 ring-sky-500/20",
  demo: "text-purple-300 bg-purple-500/10 ring-purple-500/20",
  archived: "text-slate-400 bg-slate-500/10 ring-slate-500/20",
  suppressed: "text-rose-300 bg-rose-500/10 ring-rose-500/20",
};

/**
 * Determine whether a data source is purely demo/seed data.
 *
 * Demo data is served from `lib/data.ts` when the `NEXT_PUBLIC_USE_DEMO_DATA`
 * environment variable is set to "true".  In production this flag must be
 * absent; all data must come from the live ingestion pipeline.
 */
export function isDemoDataEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_DEMO_DATA === "true";
}
