/**
 * Equipment-inventory taxonomy: Army / Navy / Air Force + AI in defence.
 * Slugs mirror supabase/migrations/20260927_equipment_inventory.sql.
 */
export type ServiceBranch = "army" | "navy" | "air_force" | "joint";
export type HoldingStatus = "operational" | "maintenance" | "ordered" | "retired" | "unknown";
export type DeploymentActivity = "conflict-operation" | "training-exercise" | "patrol-presence" | "transit" | "maintenance-refit" | "homeport" | "undisclosed";
export type WingCapacityState = "full" | "partial" | "under-strength" | "unknown";
export type AiDomain = "autonomy" | "isr-analytics" | "c2-decision" | "cyber" | "logistics-maintenance" | "loyal-wingman-cca" | "uncrewed-vessels" | "other";
export type AiProjectStatus =
  | "research"
  | "pilot"
  | "trial"
  | "operational"
  | "paused"
  | "cancelled";

export const BRANCH_LABELS: Record<ServiceBranch, string> = {
  army: "Army",
  navy: "Navy",
  air_force: "Air Force",
  joint: "Joint",
};

export const BRANCH_ORDER: ServiceBranch[] = ["army", "navy", "air_force", "joint"];

export const SUB_CATEGORY_LABELS: Record<string, string> = {
  "small-arms": "Small arms",
  tanks: "Tanks",
  "afv-ifv": "AFVs / IFVs",
  apc: "APCs",
  "artillery-towed": "Artillery (towed)",
  "artillery-sp": "Artillery (self-propelled)",
  mlrs: "MLRS / Rocket artillery",
  "air-defence-land": "Air defence (land)",
  "attack-helicopter": "Attack helicopters",
  "transport-helicopter": "Transport helicopters",
  "uav-land": "UAVs (land)",
  "engineering-logistics": "Engineering / Logistics",
  carrier: "Carriers",
  destroyer: "Destroyers",
  frigate: "Frigates",
  "corvette-patrol": "Corvettes / Patrol",
  "submarine-ssn": "Submarines (SSN)",
  "submarine-ssbn": "Submarines (SSBN)",
  "submarine-ssk": "Submarines (SSK)",
  amphibious: "Amphibious",
  auxiliary: "Auxiliaries",
  "mine-warfare": "Mine warfare",
  "naval-aviation": "Naval aviation",
  "multi-role": "Multi-role",
  attack: "Attack / Ground-attack",
  transport: "Transport",
  "tanker-refuelling": "Tanker / Refuelling",
  "awacs-aew": "AWACS / AEW&C",
  "isr-ew": "ISR / EW",
  trainer: "Trainers",
  helicopter: "Helicopters",
  "uav-ucav": "UAVs / UCAVs",
  "air-defence-air": "Air defence (air)",
};

export const SUB_CATEGORIES_BY_BRANCH: Record<ServiceBranch, string[]> = {
  army: ["small-arms", "tanks", "afv-ifv", "apc", "artillery-towed",
    "artillery-sp", "mlrs", "air-defence-land", "attack-helicopter",
    "transport-helicopter", "uav-land", "engineering-logistics"],
  navy: ["carrier", "destroyer", "frigate", "corvette-patrol",
    "submarine-ssn", "submarine-ssbn", "submarine-ssk",
    "amphibious", "auxiliary", "mine-warfare", "naval-aviation"],
  air_force: ["multi-role", "attack", "transport", "tanker-refuelling",
    "awacs-aew", "isr-ew", "trainer", "helicopter", "uav-ucav", "air-defence-air"],
  joint: [],
};

export const STATUS_LABELS: Record<HoldingStatus, string> = {
  operational: "Operational",
  maintenance: "Maintenance",
  ordered: "Ordered",
  retired: "Retired",
  unknown: "Unknown",
};

export const ACTIVITY_LABELS: Record<DeploymentActivity, string> = {
  "conflict-operation": "Conflict operation",
  "training-exercise": "Training exercise",
  "patrol-presence": "Patrol / Presence",
  transit: "Transit",
  "maintenance-refit": "Maintenance / Refit",
  homeport: "Homeport",
  undisclosed: "Undisclosed",
};

export const AI_DOMAIN_LABELS: Record<AiDomain, string> = {
  autonomy: "Autonomy",
  "isr-analytics": "ISR / Analytics",
  "c2-decision": "C2 / Decision-support",
  cyber: "Cyber",
  "logistics-maintenance": "Logistics / Predictive maintenance",
  "loyal-wingman-cca": "Loyal wingman / CCA",
  "uncrewed-vessels": "Uncrewed vessels / vehicles",
  other: "Other",
};

export const AI_STATUS_LABELS: Record<AiProjectStatus, string> = {
  research: "Research",
  pilot: "Pilot",
  trial: "Trial",
  operational: "Operational",
  paused: "Paused",
  cancelled: "Cancelled",
};

export const CAPACITY_STATE_LABELS: Record<WingCapacityState, string> = {
  full: "Full capacity",
  partial: "Partial",
  "under-strength": "Under-strength",
  unknown: "Not disclosed",
};

export function subCategoryLabel(slug: string | null | undefined): string {
  if (!slug) return "Uncategorised";
  return SUB_CATEGORY_LABELS[slug] ?? slug;
}

export function branchLabel(branch: string | null | undefined): string {
  if (branch === "army" || branch === "navy" || branch === "air_force" || branch === "joint") {
    return BRANCH_LABELS[branch];
  }
  return "Unassigned";
}

export function wingCapacityState(
  rated: number | null | undefined,
  current: number | null | undefined,
): WingCapacityState {
  if (rated == null || current == null || rated <= 0) return "unknown";
  const ratio = current / rated;
  if (ratio >= 0.95) return "full";
  if (ratio >= 0.7) return "partial";
  return "under-strength";
}

export type InventoryHolding = {
  holding_id: number;
  country_id: number;
  equipment_id: number;
  equipment_name: string | null;
  branch: string | null;
  sub_category: string | null;
  category_name: string | null;
  hull_name: string | null;
  variant: string | null;
  quantity: number | null;
  quantity_type: string | null;
  year: number | null;
  operational_qty: number | null;
  maintenance_qty: number | null;
  status: string | null;
  deployment_area: string | null;
  activity: string | null;
  activity_name: string | null;
  operator_unit: string | null;
  notes: string | null;
  source_id: number | null;
  conflict_id: number | null;
  exercise_id: number | null;
  evidence_level: string | null;
  last_verified_at: string | null;
  source_title: string | null;
  confidence: string | null;
  data_confidence: string | null;
};

export type BranchTotals = {
  holdings: number;
  total: number;
  operational: number;
  maintenance: number;
};

export function summariseByBranch(holdings: InventoryHolding[]): Record<string, BranchTotals> {
  const out: Record<string, BranchTotals> = {};
  for (const h of holdings) {
    const key = h.branch ?? "unassigned";
    const entry = out[key] ?? { holdings: 0, total: 0, operational: 0, maintenance: 0 };
    entry.holdings += 1;
    entry.total += h.quantity ?? 0;
    entry.operational += h.operational_qty
      ?? (h.status === "Active" ? h.quantity ?? 0 : 0);
    entry.maintenance += h.maintenance_qty
      ?? (h.status === "Maintenance" ? h.quantity ?? 0 : 0);
    out[key] = entry;
  }
  return out;
}

/** Normalise the live status vocabulary for display pills. */
export function displayStatus(status: string | null | undefined): HoldingStatus {
  const s = (status ?? "").toLowerCase();
  if (s === "active" || s === "operational") return "operational";
  if (s === "maintenance" || s === "maintenance / refit") return "maintenance";
  if (s === "ordered" || s === "planned") return "ordered";
  if (s === "retired") return "retired";
  return "unknown";
}

export function readinessPercent(totals: BranchTotals): number | null {
  const denom = totals.operational + totals.maintenance;
  if (denom <= 0) return null;
  return Math.round((totals.operational / denom) * 100);
}

