/**
 * Effectiveness index (patch 0.2 doc).
 *
 * Criteria fixed in the doc: "did the equipment arrive on time and did it
 * arrive without going over budget". We compute a transparent, evidence-
 * gated score from contract records only — no editorial judgement.
 *
 * A contract is *assessable* only when it records both planned and actual
 * figures. Anything else is excluded (not scored as zero) and shown as
 * "insufficient data".
 */

export type AssessableContract = {
  planned_end_date: string | null;
  actual_end_date: string | null;
  planned_value_usd: number | null;
  actual_value_usd: number | null;
};

export type EffectivenessScore = {
  /** 0–100, or null when there is no assessable data. */
  score: number | null;
  assessed: number;
  onTime: number;
  onBudget: number;
  averageDelayDays: number | null;
  averageOverrunPercent: number | null;
};

export function computeEffectiveness(
  contracts: AssessableContract[],
): EffectivenessScore {
  let assessed = 0;
  let onTime = 0;
  let onBudget = 0;
  let delayDaysSum = 0;
  let delayDaysCount = 0;
  let overrunSum = 0;
  let overrunCount = 0;

  for (const c of contracts) {
    const hasDates = Boolean(c.planned_end_date && c.actual_end_date);
    const hasValues =
      c.planned_value_usd != null &&
      c.actual_value_usd != null &&
      c.planned_value_usd > 0;
    if (!hasDates && !hasValues) continue;

    assessed += 1;

    if (hasDates) {
      const delay =
        (new Date(c.actual_end_date!).getTime() -
          new Date(c.planned_end_date!).getTime()) /
        86_400_000;
      if (delay <= 0) onTime += 1;
      delayDaysSum += Math.max(0, delay);
      delayDaysCount += 1;
    }

    if (hasValues) {
      const overrun =
        ((c.actual_value_usd! - c.planned_value_usd!) / c.planned_value_usd!) * 100;
      if (overrun <= 0) onBudget += 1;
      overrunSum += Math.max(0, overrun);
      overrunCount += 1;
    }
  }

  if (assessed === 0) {
    return {
      score: null,
      assessed: 0,
      onTime: 0,
      onBudget: 0,
      averageDelayDays: null,
      averageOverrunPercent: null,
    };
  }

  const timeRate = delayDaysCount > 0 ? onTime / delayDaysCount : null;
  const budgetRate = overrunCount > 0 ? onBudget / overrunCount : null;

  /*
   * Weighted blend: on-time and on-budget count equally when both are
   * measurable; whichever single dimension is available determines the
   * score when the other is not recorded.
   */
  let score: number | null = null;
  if (timeRate !== null && budgetRate !== null) {
    score = ((timeRate + budgetRate) / 2) * 100;
  } else if (timeRate !== null) {
    score = timeRate * 100;
  } else if (budgetRate !== null) {
    score = budgetRate * 100;
  }

  return {
    score: score === null ? null : Math.round(score),
    assessed,
    onTime,
    onBudget,
    averageDelayDays:
      delayDaysCount > 0 ? Math.round(delayDaysSum / delayDaysCount) : null,
    averageOverrunPercent:
      overrunCount > 0 ? Math.round(overrunSum / overrunCount) : null,
  };
}

export function effectivenessBand(score: number | null): {
  label: string;
  badgeClass: string;
} {
  if (score === null) {
    return {
      label: "Insufficient data",
      badgeClass: "bg-slate-800 text-slate-400 border border-slate-700",
    };
  }
  if (score >= 80) {
    return {
      label: "Strong delivery",
      badgeClass: "bg-green-900/40 text-green-300 border border-green-800",
    };
  }
  if (score >= 50) {
    return {
      label: "Mixed delivery",
      badgeClass: "bg-amber-900/40 text-amber-300 border border-amber-800",
    };
  }
  return {
    label: "Poor delivery",
    badgeClass: "bg-red-900/40 text-red-300 border border-red-800",
  };
}
