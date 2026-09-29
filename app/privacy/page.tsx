export const metadata = {
  title: "Privacy Notice — Defence Intelligence Platform",
  description: "How the Defence Intelligence Platform handles personal data.",
};

const cookies = [
  {
    name: "sb-* auth cookies",
    purpose: "Keeps you signed in and secures your session ( Supabase Auth ).",
    type: "Strictly necessary",
    duration: "Session / refresh period",
    party: "First party, HttpOnly, SameSite=Strict, Secure",
  },
  {
    name: "_csrf_token",
    purpose: "Prevents cross-site request forgery on state-changing actions.",
    type: "Strictly necessary",
    duration: "60 minutes",
    party: "First party, HttpOnly, SameSite=Strict, Secure",
  },
  {
    name: "anon_search_session",
    purpose:
      "A random identifier so search analytics can be counted without storing your IP or identity. The identifier is stored only as a salted one-way hash.",
    type: "Strictly necessary (security & abuse prevention)",
    duration: "30 days",
    party: "First party, HttpOnly, SameSite=Strict, Secure",
  },
  {
    name: "ticker_dismissed_at (localStorage)",
    purpose: "Remembers that you dismissed the market ticker widget for 24 hours.",
    type: "Functionality storage",
    duration: "24 hours",
    party: "First party, not a cookie — browser localStorage",
  },
  {
    name: "defence-appearance (localStorage)",
    purpose: "Stores your theme, accent colour, density and text-size preferences.",
    type: "Functionality storage",
    duration: "Until cleared",
    party: "First party, not a cookie — browser localStorage",
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 pb-16">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold">Privacy Notice</h1>
        <p className="text-sm text-slate-500">
          Version 2.0 — last updated 27 September 2026. Applies to the Defence
          Intelligence Platform website and API.
        </p>
      </header>

      <section className="intel-surface space-y-4 p-6 text-sm leading-6 text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">1. Who we are</h2>
        <p>
          The Defence Intelligence Platform is published and operated by{" "}
          <strong className="text-slate-100">[INSERT LEGAL ENTITY / TRADING NAME]</strong> of{" "}
          <strong className="text-slate-100">[INSERT CONTACT ADDRESS]</strong>. For all
          privacy matters contact{" "}
          <strong className="text-slate-100">[INSERT PRIVACY CONTACT EMAIL]</strong>.
          You also have the right to complain to the Information
          Commissioner&apos;s Office (ico.org.uk) if you are in the UK.
        </p>

        <h2 className="text-lg font-semibold text-slate-100 pt-4">2. What we collect</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Account data</strong> (if you register): email address,
            authentication identifiers, subscription/billing status. Payment
            card details are collected and processed solely by our payment
            provider (Stripe) — card data never touches our servers.
          </li>
          <li>
            <strong>Anonymous analytics</strong>: search queries are logged as
            salted one-way hashes together with a hashed random session
            identifier, a coarse timestamp and the number of results. We do not
            store raw IP addresses, raw queries, or any identifier that can be
            linked to your identity.
          </li>
          <li>
            <strong>Privacy requests</strong> (if you submit one): name, email
            and request details, used solely to process your request.
          </li>
          <li>
            <strong>Strictly necessary storage</strong>: the cookies and
            localStorage entries listed in section 6.
          </li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-100 pt-4">3. Why we process it (lawful bases)</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Contract</strong> — to provide your account, subscription
            and saved preferences.
          </li>
          <li>
            <strong>Legitimate interests</strong> — security, abuse prevention
            (rate limiting, CSRF protection) and aggregate product analytics,
            balanced against your rights and expectations. You can object by
            contacting us.
          </li>
          <li>
            <strong>Legal obligation</strong> — retaining billing records where
            required by tax law.
          </li>
          <li>
            <strong>Consent</strong> — any optional user survey responses you
            choose to submit. Withdraw consent at any time.
          </li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-100 pt-4">4. Retention</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Account records: for the life of your account, then 30 days.</li>
          <li>Billing records: up to 7 years, where legally required.</li>
          <li>Anonymous search hashes: rolling 12 months, then deleted.</li>
          <li>Privacy requests: 24 months after closure.</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-100 pt-4">5. Sharing and transfers</h2>
        <p>
          We share personal data only with processors necessary to run the
          service: Supabase (database and authentication, hosted in the EU/UK
          region) and Stripe (payments). International transfers, where they
          occur, rely on the UK-IDTA / UK Addendum to the EU Standard
          Contractual Clauses. We do not sell personal data, and we do not use
          advertising or social-media trackers.
        </p>

        <h2 className="text-lg font-semibold text-slate-100 pt-4">6. Cookies and storage</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-700 text-slate-400 uppercase">
              <tr>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Purpose</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {cookies.map((c) => (
                <tr key={c.name}>
                  <td className="py-2 pr-3 font-mono text-slate-200">{c.name}</td>
                  <td className="py-2 pr-3">{c.purpose}</td>
                  <td className="py-2 pr-3">{c.type}</td>
                  <td className="py-2">{c.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-slate-400">
          Because we set only strictly necessary cookies and functionality
          storage, no cookie-consent banner is required. There are no
          third-party advertising or analytics cookies.
        </p>

        <h2 className="text-lg font-semibold text-slate-100 pt-4">7. Your rights</h2>
        <p>
          Under UK GDPR you have rights of access, rectification, erasure,
          restriction, portability and objection, and rights around automated
          decision-making (we make no solely-automated decisions with legal
          effect). Use the{" "}
          <a href="/opt-out" className="intel-link">privacy opt-out page</a> to
          exercise suppression or deletion, or email our privacy contact. We
          respond within one month.
        </p>

        <h2 className="text-lg font-semibold text-slate-100 pt-4">8. Security</h2>
        <p>
          Sessions use HttpOnly, SameSite=Strict, Secure cookies; state-changing
          endpoints are CSRF-protected; sensitive endpoints are rate-limited;
          and database access is governed by row-level security policies. Report
          vulnerabilities via the contact address in section 1 — we will not
          pursue good-faith researchers.
        </p>

        <h2 className="text-lg font-semibold text-slate-100 pt-4">9. Changes</h2>
        <p>
          Material changes to this notice will be announced on the site at least
          14 days before they take effect.
        </p>
      </section>
    </main>
  );
}
