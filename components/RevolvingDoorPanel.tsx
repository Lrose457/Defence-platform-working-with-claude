type Tenure = {
  id: number;
  person_name: string | null;
  person_id: number | null;
  former_role: string | null;
  former_organisation: string | null;
  industry_role: string | null;
  started_on: string | null;
  ended_on: string | null;
  source_name: string | null;
  source_url: string | null;
  evidence_level: string | null;
};

/**
 * Revolving-door panel (patch 0.2 doc): demonstrates the link between
 * former politicians and existing figures in the defence industry, per
 * company. Every entry carries its source; nothing is inferred.
 */
export default function RevolvingDoorPanel({ tenures }: { tenures: Tenure[] }) {
  if (tenures.length === 0) {
    return (
      <section className="rounded border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
          Revolving door
        </h2>
        <p className="mt-2 text-xs text-slate-500">
          No documented moves between public office and this company are
          recorded yet. Entries appear only when a public move is sourced.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
          Revolving door · {tenures.length} documented move{tenures.length === 1 ? "" : "s"}
        </h2>
        <span className="text-[10px] text-slate-600">
          Former public officials now holding industry roles
        </span>
      </div>
      <ul className="mt-3 divide-y divide-slate-800">
        {tenures.map((t) => (
          <li key={t.id} className="py-3 text-sm">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium text-slate-200">
                {t.person_name ?? "Unnamed individual"}
              </span>
              <span className="text-[10px] font-mono uppercase text-slate-500">
                {t.evidence_level ?? "unverified"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              <span className="text-slate-300">{t.former_role ?? "Public role not recorded"}</span>
              {t.former_organisation ? ` · ${t.former_organisation}` : ""}
              {" → "}
              <span className="text-blue-300">{t.industry_role ?? "Industry role not recorded"}</span>
              {t.started_on ? ` · from ${t.started_on}` : ""}
            </p>
            {t.source_url && (
              <a
                href={t.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-[11px] text-blue-500 hover:text-blue-400"
              >
                Source: {t.source_name ?? t.source_url} ↗
              </a>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-slate-800 pt-2 text-[10px] leading-5 text-slate-600">
        Inclusion documents a factual employment move. It does not imply
        wrongdoing. Corrections are welcome via the contact address on the
        data licences page.
      </p>
    </section>
  );
}
