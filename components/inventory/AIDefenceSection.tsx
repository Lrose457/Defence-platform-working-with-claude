"use client";

import Link from "next/link";
import { AI_DOMAIN_LABELS, AI_STATUS_LABELS } from "@/lib/inventory";
import { EvidenceBadge } from "./badges";

export type AiProjectRow = {
  id: number;
  programme_name: string | null;
  domain: string | null;
  status: string | null;
  lead_agency: string | null;
  company_id: number | null;
  company_name: string | null;
  programme_id: number | null;
  programme_link_name: string | null;
  contract_id: number | null;
  contract_title: string | null;
  description: string | null;
  evidence_level: string | null;
  source_title: string | null;
};

const STATUS_TONE: Record<string, string> = {
  research: "border-slate-700 bg-slate-900 text-slate-300",
  pilot: "border-sky-800 bg-sky-950/40 text-sky-300",
  trial: "border-blue-800 bg-blue-950/40 text-blue-300",
  operational: "border-emerald-800 bg-emerald-950/40 text-emerald-300",
  paused: "border-amber-800 bg-amber-950/40 text-amber-300",
  cancelled: "border-red-800 bg-red-950/40 text-red-300",
};

export default function AIDefenceSection({ projects }: { projects: AiProjectRow[] }) {
  const domains = new Map<string, number>();
  for (const p of projects) {
    const d = (p.domain ?? "other").toLowerCase();
    domains.set(d, (domains.get(d) ?? 0) + 1);
  }
  const max = Math.max(1, ...domains.values());
  return (
    <section id="ai-defence" className="scroll-mt-24 space-y-4">
      <div className="flex items-end justify-between border-b border-slate-800 pb-2">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-widest text-white">AI in Defence</h2>
          <p className="font-mono text-[11px] text-slate-500">
            {projects.length} government programmes · industry intersection per card
          </p>
        </div>
      </div>
      {projects.length === 0 ? (
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
          No verified government AI programmes are recorded for this country yet.
        </div>
      ) : (
        <>
          <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Projects by AI domain</p>
            <div className="mt-2 space-y-2">
              {Array.from(domains.entries()).map(([domain, count]) => (
                <div key={domain} className="flex items-center gap-3 text-xs">
                  <span className="w-56 truncate text-slate-300">
                    {AI_DOMAIN_LABELS[domain as keyof typeof AI_DOMAIN_LABELS] ?? domain}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.round((count / max) * 100)}%` }} />
                  </div>
                  <span className="w-8 text-right font-mono text-slate-400">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {projects.map((p) => {
              const status = (p.status ?? "research").toLowerCase();
              return (
                <div key={p.id} className="rounded border border-slate-800 bg-slate-900/50 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-100">{p.programme_name ?? `Programme ${p.id}`}</p>
                    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_TONE[status] ?? STATUS_TONE.research}`}>
                      {AI_STATUS_LABELS[status as keyof typeof AI_STATUS_LABELS] ?? p.status}
                    </span>
                  </div>
                  <p className="text-[11px] uppercase tracking-wider text-violet-300">
                    {AI_DOMAIN_LABELS[(p.domain ?? "other").toLowerCase() as keyof typeof AI_DOMAIN_LABELS] ?? p.domain}
                    {p.lead_agency ? <span className="ml-2 text-slate-500 normal-case">· {p.lead_agency}</span> : null}
                  </p>
                  {p.description && <p className="text-xs leading-5 text-slate-400">{p.description}</p>}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                    <span className="uppercase tracking-wider text-slate-500">Industry link →</span>
                    {p.company_id ? (
                      <Link href={`/companies/${p.company_id}`} className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-slate-300 hover:text-blue-400">
                        {p.company_name ?? `Company ${p.company_id}`}
                      </Link>
                    ) : (
                      <span className="text-slate-600">No company linked yet</span>
                    )}
                    {p.contract_id && (
                      <Link href={`/contracts/${p.contract_id}`} className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-slate-300 hover:text-blue-400">
                        {p.contract_title ?? `Contract ${p.contract_id}`}
                      </Link>
                    )}
                    {p.programme_id && (
                      <Link href={`/programmes/${p.programme_id}`} className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-slate-300 hover:text-blue-400">
                        {p.programme_link_name ?? `Programme ${p.programme_id}`}
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <EvidenceBadge level={p.evidence_level} />
                    {p.source_title && <span className="text-[10px] text-slate-500">{p.source_title}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

