import { intelligenceSources, type SourceAccess } from "@/lib/sourceRegistry";
import { provenanceToneClass, scoreSourceProvenance } from "@/lib/provenance";

const accessClass: Record<SourceAccess, string> = {
  Live: "bg-emerald-500/10 text-emerald-400",
  "API key": "bg-amber-500/10 text-amber-400",
  Licensed: "bg-rose-500/10 text-rose-400",
  Research: "bg-slate-800 text-slate-300",
};

export default function SourcesPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Intelligence Provenance</h1>
        <p className="text-xl text-slate-400">Source hierarchy and reliability mapping.</p>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-800/50 text-xs text-slate-400 uppercase">
            <tr className="border-b border-slate-800">
              <th className="p-4">Source</th>
              <th className="p-4">Category</th>
              <th className="p-4">Access</th>
              <th className="p-4">Adapter</th>
              <th className="p-4">Provenance</th>
              <th className="p-4">Integration</th>
              <th className="p-4">Best for</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {intelligenceSources.map((source) => {
              const provenance = scoreSourceProvenance({
                title: source.name,
                publisher: source.publisher,
                url: source.url,
                source_type: source.category,
                reliability:
                  source.access === "Live"
                    ? "High"
                    : source.access === "Licensed"
                      ? "High"
                      : source.access === "API key"
                        ? "Medium"
                        : "Medium",
                notes: `${source.integration}. ${source.value}`,
              });

              return (
                <tr key={source.id} className="hover:bg-slate-800/30 transition-colors align-top">
                  <td className="p-4">
                    <a href={source.url} target="_blank" rel="noreferrer" className="font-medium text-blue-400 hover:text-blue-300">
                      {source.name}
                    </a>
                    <p className="mt-1 text-xs text-slate-500">{source.publisher}</p>
                  </td>
                  <td className="p-4 text-xs text-slate-400">{source.category}</td>
                  <td className="p-4">
                    <span className={`inline-flex rounded px-2 py-1 text-xs font-bold ${accessClass[source.access]}`}>
                      {source.access}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${source.requiresCredentials ? "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20" : "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20"}`}>
                      {source.requiresCredentials ? "Credentials" : "Open"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${provenanceToneClass(provenance.coverage)}`}>
                        {provenance.coverage}
                      </span>
                      <span className="text-xs text-slate-300">{provenance.score}%</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-400">{source.integration}</td>
                  <td className="p-4 text-sm text-slate-400">{source.value}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
