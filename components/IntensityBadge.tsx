import Link from "next/link";
import {
  CONFLICT_INTENSITY_LEVELS,
  getIntensity,
} from "@/lib/conflictIntensity";

export function IntensityBadge({ level }: { level: number | null | undefined }) {
  const intensity = getIntensity(level);
  if (!intensity) {
    return (
      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-600">
        Intensity: not assessed
      </span>
    );
  }
  return (
    <span
      title={intensity.description}
      className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${intensity.badgeClass}`}
    >
      {intensity.shortName}
    </span>
  );
}

export function IntensityLegend() {
  return (
    <section className="rounded border border-slate-800 bg-slate-900/50 p-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-300">
        Conflict intensity scale
      </h2>
      <p className="mt-1 text-[10px] text-slate-500">
        Applied platform-side following the HIIK Conflict Barometer
        methodology (see <Link href="/data-licences" className="intel-link">data licences</Link>).
        Levels are assessments, not HIIK grades.
      </p>
      <ol className="mt-3 space-y-2">
        {CONFLICT_INTENSITY_LEVELS.map((l) => (
          <li key={l.level} className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-1 inline-block h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: l.color }}
            />
            <div>
              <p className="text-xs font-semibold text-slate-200">
                Level {l.level}: {l.name}
              </p>
              <p className="text-[11px] leading-5 text-slate-500">{l.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
