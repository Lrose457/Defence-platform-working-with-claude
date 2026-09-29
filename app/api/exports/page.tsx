export default function ExportsPage() {
  return (
    <main className="intel-page">
      <h1 className="intel-page-title">Exports</h1>
      <a
        href="/api/exports/changes"
        className="inline-flex min-h-10 items-center rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
      >
        Export intelligence changes
      </a>
    </main>
  );
}