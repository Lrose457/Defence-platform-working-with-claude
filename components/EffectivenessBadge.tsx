import { effectivenessBand } from "@/lib/effectiveness";

/**
 * Displays a company's effectiveness score with its band. The tooltip
 * explains exactly what the number means (doc criteria: on time, on
 * budget) so the metric is never a bare, unexplained figure.
 */
export default function EffectivenessBadge({
  score,
  assessed,
  averageDelayDays,
  averageOverrunPercent,
}: {
  score: number | null;
  assessed: number;
  averageDelayDays: number | null;
  averageOverrunPercent: number | null;
}) {
  const band = effectivenessBand(score);
  const tooltip =
    score === null
      ? "No contracts with both planned and actual dates/value are recorded, so effectiveness cannot be assessed yet."
      : `Score ${score}/100 across ${assessed} assessable contract${assessed === 1 ? "" : "s"} (on-time and on-budget delivery, equally weighted)${
          averageDelayDays ? ` · avg delay ${averageDelayDays} days` : ""
        }${averageOverrunPercent ? ` · avg overrun ${averageOverrunPercent}%` : ""}.`;

  return (
    <span
      title={tooltip}
      className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${band.badgeClass}`}
    >
      {score === null ? "Effectiveness: n/a" : `Effectiveness ${score}/100 · ${band.label}`}
    </span>
  );
}
