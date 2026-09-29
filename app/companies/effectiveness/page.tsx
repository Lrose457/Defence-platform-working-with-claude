export const metadata = {
  title: "Effectiveness Index — Methodology — Defence Intelligence Platform",
  description: "How the defence effectiveness index is computed and its limits.",
};

export default function EffectivenessMethodologyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 pb-16">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold">Effectiveness Index — Methodology</h1>
        <p className="text-sm text-slate-500">
          The doc-defined criteria: <em>did the equipment arrive on time, and did
          it arrive without going over budget?</em>
        </p>
      </header>

      <section className="intel-surface space-y-4 p-6 text-sm leading-6 text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">1. What is measured</h2>
        <p>
          For each company, we look at its tracked contracts. A contract is
          <strong> assessable</strong> only when it records both planned and
          actual figures:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>a planned completion date and an actual completion date; or</li>
          <li>a planned (budgeted) value and an actual (final) value.</li>
        </ul>
        <p>
          Contracts missing both are excluded — they count as
          &quot;insufficient data&quot;, never as a failure. This prevents the
          index from being dominated by whoever happens to publish the most
          paperwork.
        </p>

        <h2 className="text-lg font-semibold text-slate-100 pt-2">2. The two criteria</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>On time:</strong> actual completion date is on or before the
            planned completion date. Late deliveries contribute to the average
            delay figure (in days).
          </li>
          <li>
            <strong>On budget:</strong> actual value is less than or equal to
            planned value. Overruns contribute to the average overrun figure
            (in % of planned value).
          </li>
        </ul>
        <p>
          The company score is the equally-weighted average of the on-time rate
          and the on-budget rate across assessable contracts, expressed /100.
          When only one dimension is recorded, it stands alone.
        </p>

        <h2 className="text-lg font-semibold text-slate-100 pt-2">3. Bands</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>80–100: Strong delivery</strong> — most assessable contracts on time and on budget.</li>
          <li><strong>50–79: Mixed delivery</strong> — a substantial share miss one or both criteria.</li>
          <li><strong>Below 50: Poor delivery</strong> — most assessable contracts are late and/or over budget.</li>
          <li><strong>n/a: Insufficient data</strong> — no assessable contracts recorded yet.</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-100 pt-2">4. Known limitations</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Coverage is only as good as public sourcing. Large classified or
            non-disclosed programmes are invisible, which can flatter some
            companies.
          </li>
          <li>
            &quot;Completion&quot; follows the recorded contract data; where a
            contract is re-baselined, the latest recorded plan is used and the
            history is retained in the entity record.
          </li>
          <li>
            The index measures delivery, not quality or operational
            performance — a delivered system can still fail in service, and an
            on-time system can still be obsolescent.
          </li>
        </ul>
        <p>
          Every score shown on the platform carries its assessable-contract
          count in its tooltip, so the size of the evidence base is always
          visible alongside the number.
        </p>
      </section>
    </main>
  );
}
