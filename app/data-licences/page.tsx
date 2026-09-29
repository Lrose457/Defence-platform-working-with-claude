export const metadata = {
  title: "Data Licences & Attribution — Defence Intelligence Platform",
  description:
    "Sources, licences and attribution for every dataset shown on the platform.",
};

const licences = [
  {
    name: "SIPRI Military Expenditure Database",
    what: "National defence spending figures (budgets, trends).",
    licence:
      "Free for non-commercial use with attribution. © SIPRI. Redistribution of derived charts must credit 'SIPRI Military Expenditure Database'.",
    url: "https://www.sipri.org/databases/milex",
    status: "Attributed on every spending chart",
  },
  {
    name: "USAspending.gov",
    what: "US federal contract awards (public federal awards on company pages).",
    licence:
      "US Government public-domain data. Attribution requested: 'Data from USAspending.gov'.",
    url: "https://www.usaspending.gov/",
    status: "Linked on company award tables",
  },
  {
    name: "Finnhub",
    what: "Delayed stock quotes for the defence market ticker.",
    licence:
      "Provided under Finnhub's terms of service; free-tier quotes may be delayed 15–20 minutes. Not investment advice.",
    url: "https://finnhub.io/",
    status: "Disclaimer shown under ticker & table",
  },
  {
    name: "GLEIF",
    what: "Legal-entity identifiers for company records.",
    licence:
      "CC BY 4.0. © Global Legal Entity Identifier Foundation. Requires attribution and licence link.",
    url: "https://www.gleif.org/en/lei-data/gleif-lei-data-free-to-use",
    status: "Attribution to be shown on company entity records",
  },
  {
    name: "UCDP (Uppsala Conflict Data Program)",
    what: "Organised-violence and conflict event records powering conflict intensity levels.",
    licence:
      "Free for research and non-commercial use with attribution: 'Pettersson & Öberg (2020). Organized violence, 1989–2019. Journal of Peace Research'. Data must not be presented as official UCDP output.",
    url: "https://ucdp.uu.se/",
    status: "Attribution shown on conflict pages",
  },
  {
    name: "ACLED (Armed Conflict Location & Event Data)",
    what: "Granular conflict event feeds where licensed.",
    licence:
      "Requires a (free) registration and is licence-restricted; use must comply with ACLED's terms of use. Only ingested under an active licence.",
    url: "https://acleddata.com/",
    status: "Not yet ingested — pending licence",
  },
  {
    name: "HIIK (Heidelberg Institute)",
    what: "Conflict Barometer intensity methodology (Levels 1–5).",
    licence:
      "HIIK datasets are not openly licensed. We use their published five-level intensity *methodology* for our own scale, with credit, but do not redistribute HIIK data without written permission.",
    url: "https://hiik.de/",
    status: "Methodology credited on the intensity legend",
  },
  {
    name: "UK Companies House / OpenCorporates",
    what: "Company registration data and officer appointments (revolving-door module).",
    licence:
      "Companies House data is subject to its own terms of use; OpenCorporates requires licence compliance for commercial use.",
    url: "https://find-and-update.company-information.service.gov.uk/",
    status: "Attribution shown where ingested",
  },
];

export default function DataLicencesPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-8 pb-16">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold">Data Licences & Attribution</h1>
        <p className="text-sm text-slate-500">
          Every dataset displayed on this platform comes from a named public
          source. This page records what we use, under which licence, and how it
          is credited. Corrections or takedown requests:{" "}
          <span className="font-mono text-slate-300">[INSERT CONTACT EMAIL]</span>.
        </p>
      </header>

      <div className="space-y-4">
        {licences.map((l) => (
          <section key={l.name} className="intel-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-100">{l.name}</h2>
              <span className="intel-badge">{l.status}</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">{l.what}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{l.licence}</p>
            <a
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="intel-link mt-2 inline-block text-xs"
            >
              Source & licence ↗
            </a>
          </section>
        ))}
      </div>

      <section className="intel-surface p-5 text-sm leading-6 text-slate-300">
        <h2 className="text-base font-semibold text-slate-100">Copyright & takedown</h2>
        <p className="mt-2">
          We present factual data with attribution and link to the original
          publisher wherever possible. If you believe content on this site
          infringes your rights, email{" "}
          <span className="font-mono text-slate-300">[INSERT CONTACT EMAIL]</span>{" "}
          with the page URL, the material concerned and the basis of your
          complaint. Verified requests are actioned within 14 working days.
        </p>
      </section>
    </main>
  );
}
