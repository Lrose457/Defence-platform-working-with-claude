/**
 * Five-level conflict intensity scale.
 *
 * Level definitions follow the HIIK Conflict Barometer methodology
 * (credited on /data-licences), applied platform-side to conflict records
 * ingested from open event sources such as UCDP. A conflict's level is a
 * platform assessment, not a HIIK grade, and is shown with its evidence.
 */

export type ConflictIntensity = {
  level: 1 | 2 | 3 | 4 | 5;
  name: string;
  shortName: string;
  description: string;
  /** Tailwind classes for badges. */
  badgeClass: string;
  /** Fill colour used on maps and bar visualisations. */
  color: string;
};

export const CONFLICT_INTENSITY_LEVELS: ConflictIntensity[] = [
  {
    level: 1,
    name: "Dispute (non-violent)",
    shortName: "L1 Dispute",
    description:
      "A political conflict over position, power, or goods, carried out without physical force.",
    badgeClass: "bg-slate-800 text-slate-300 border border-slate-700",
    color: "#64748b",
  },
  {
    level: 2,
    name: "Non-violent crisis",
    shortName: "L2 Crisis",
    description:
      "One or more actors use threats of force, economic sanctions, or diplomatic expulsions, but no actual physical violence occurs.",
    badgeClass: "bg-sky-900/40 text-sky-300 border border-sky-800",
    color: "#38bdf8",
  },
  {
    level: 3,
    name: "Violent crisis",
    shortName: "L3 Violent crisis",
    description:
      "Violence is used sporadically or target-specifically (isolated attacks, border skirmishes, minor sabotage) but lacks systematic organization.",
    badgeClass: "bg-amber-900/40 text-amber-300 border border-amber-800",
    color: "#f59e0b",
  },
  {
    level: 4,
    name: "Limited war",
    shortName: "L4 Limited war",
    description:
      "Organized, systematic use of force by at least one party. High destruction, but limited geographically or temporally (e.g. regional insurgencies).",
    badgeClass: "bg-orange-900/40 text-orange-300 border border-orange-800",
    color: "#f97316",
  },
  {
    level: 5,
    name: "War",
    shortName: "L5 War",
    description:
      "Massive, violent, systematically organized conflict with sustained, high-intensity combat, widespread destruction, and massive societal disruption.",
    badgeClass: "bg-red-900/40 text-red-300 border border-red-800",
    color: "#ef4444",
  },
];

export function getIntensity(level: number | null | undefined): ConflictIntensity | null {
  if (level === null || level === undefined) return null;
  return CONFLICT_INTENSITY_LEVELS.find((l) => l.level === level) ?? null;
}
