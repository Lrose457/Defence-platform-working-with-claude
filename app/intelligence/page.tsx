import Link from "next/link";

export default function IntelligencePage() {
  return (
    <main className="space-y-6">
      <div className="flex justify-between items-end border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Analyst Console</h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Intelligence Curation & Dataset Maintenance
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <div className="grid gap-4 grid-cols-2">
            <Link
              href="/intelligence/new"
              className="p-4 rounded border border-slate-800 bg-slate-900/50 hover:border-blue-600 transition-all group"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-2">Ingestion</p>
              <h2 className="text-lg font-semibold text-slate-100 group-hover:text-white transition-colors">
                Record Intelligence
              </h2>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Add a verified, source-backed development to an existing entity.
              </p>
            </Link>

            <Link
              href="/changes"
              className="p-4 rounded border border-slate-800 bg-slate-900/50 hover:border-slate-600 transition-all group"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Audit</p>
              <h2 className="text-lg font-semibold text-slate-100 group-hover:text-white transition-colors">
                Review Changes
              </h2>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Verify source-backed developments already recorded in the platform.
              </p>
            </Link>
          </div>

          <section className="rounded border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">System Protocols</h2>
            <div className="grid gap-4 grid-cols-4">
              {[
                { step: '01', label: 'Find', desc: 'Identify a relevant public source.' },
                { step: '02', label: 'Verify', desc: 'Cross-reference source validity.' },
                { step: '03', label: 'Assess', desc: 'Determine confidence & importance.' },
                { step: '04', label: 'Publish', desc: 'Commit to intelligence layer.' },
              ].map((item, i) => (
                <div key={i} className="p-3 rounded bg-slate-950/50 border border-slate-800/50">
                  <p className="text-[10px] font-bold text-blue-500">{item.step}</p>
                  <h3 className="text-xs font-semibold text-slate-200">{item.label}</h3>
                  <p className="mt-1 text-[10px] text-slate-500 leading-tight">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Workspace Info</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              The Analyst Console is for maintaining the platform&apos;s curated
              intelligence dataset. Public users consume the resulting data and
              sources; they do not directly modify intelligence records.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-800">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-slate-500">Auth Level:</span>
                <span className="text-green-500">ADMIN_RESEARCHER</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono mt-1">
                <span className="text-slate-500">Dataset Version:</span>
                <span className="text-slate-300">v1.0.4-stable</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
