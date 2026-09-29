export type ProvenanceCoverage = "complete" | "partial" | "missing";

export type ProvenanceSnapshot = {
  score: number;
  coverage: ProvenanceCoverage;
  checks: {
    title: boolean;
    publisher: boolean;
    url: boolean;
    sourceType: boolean;
    reliability: boolean;
    notes: boolean;
  };
};

type SourceMeta = {
  title?: string | null;
  publisher?: string | null;
  url?: string | null;
  source_type?: string | null;
  reliability?: string | null;
  notes?: string | null;
};

export function scoreSourceProvenance(source: SourceMeta): ProvenanceSnapshot {
  const checks = {
    title: Boolean(source.title && source.title.trim().length > 0),
    publisher: Boolean(source.publisher && source.publisher.trim().length > 0),
    url: Boolean(source.url && source.url.trim().length > 0),
    sourceType: Boolean(source.source_type && source.source_type.trim().length > 0),
    reliability: Boolean(source.reliability && source.reliability.trim().length > 0),
    notes: Boolean(source.notes && source.notes.trim().length > 0),
  };

  const filled = Object.values(checks).filter(Boolean).length;
  const score = Math.round((filled / Object.keys(checks).length) * 100);

  let coverage: ProvenanceCoverage = "missing";

  if (score >= 80) {
    coverage = "complete";
  } else if (score >= 50) {
    coverage = "partial";
  }

  return { score, coverage, checks };
}

export function provenanceToneClass(coverage: ProvenanceCoverage) {
  switch (coverage) {
    case "complete":
      return "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20";
    case "partial":
      return "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20";
    default:
      return "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/20";
  }
}
