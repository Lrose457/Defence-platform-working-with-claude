export const metadata = {
  title: "Terms of Service — Defence Intelligence Platform",
  description: "The terms governing use of the Defence Intelligence Platform.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 pb-16">
      <h1 className="text-4xl font-bold">Terms of Service</h1>
      <p className="text-slate-400">
        Version 2.0 — 27 September 2026. By using this platform you agree to
        these terms. The service is operated by{" "}
        <strong className="text-slate-200">Leo Rosenthal</strong>{" "}
        (&quot;we&quot;), contact:{" "}
        <span className="font-mono text-slate-300">leojudahrosenthal@gmail.com</span>.
      </p>

      <section className="intel-surface space-y-4 p-6 text-sm leading-6 text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">1. Lawful, responsible research</h2>
        <p>
          Use of this platform requires lawful, responsible research. You must
          not use the service for doxxing, stalking, harassment, unlawful
          access, threats, or evasion of applicable law.
        </p>

        <h2 className="text-lg font-semibold text-slate-100 pt-2">2. No warranty; verify before acting</h2>
        <p>
          Information is provided for research and intelligence analysis &quot;as
          is&quot;. Every record carries source and confidence metadata — you are
          responsible for verifying information before acting on it. To the
          maximum extent permitted by law, the service is provided without
          warranties and we are not liable for indirect or consequential loss,
          or for decisions made from platform data.
        </p>

        <h2 className="text-lg font-semibold text-slate-100 pt-2">3. Indemnity</h2>
        <p>
          You agree to indemnify the service and its operators against claims
          arising from your misuse, unlawful conduct, or breach of these terms.
        </p>

        <h2 className="text-lg font-semibold text-slate-100 pt-2">4. Subscriptions</h2>
        <p>
          Paid plans renew automatically until cancelled via your account page.
          Statutory cancellation rights are unaffected. Refunds for partial
          periods are at our discretion except where required by law.
        </p>

        <h2 className="text-lg font-semibold text-slate-100 pt-2">5. Copyright & takedown</h2>
        <p>
          Platform data is aggregated from public sources credited on our{" "}
          <a href="/data-licences" className="intel-link">data licences page</a>.
          Copyright complaints and takedown requests should be sent to the
          contact address above; verified requests are actioned within 14
          working days. These terms are governed by the laws of England and
          Wales, and the courts of England and Wales have exclusive
          jurisdiction.
        </p>
      </section>
    </main>
  );
}
