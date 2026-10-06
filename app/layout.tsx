import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import AppearanceSettings from "@/components/AppearanceSettings";
import UserSurvey from "@/components/UserSurvey";
import { getCsrfToken } from "@/lib/security/csrf";

export const metadata: Metadata = {
  title: "Defence Intelligence Platform",
  description: "Track defence spending and procurement.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const csrfToken = await getCsrfToken();
  return (
    <html lang="en">
      <head>
        {/* Embed CSRF token for client-side fetch calls. httpOnly cookie cannot be read by JS. */}
        <meta name="csrf-token" content={csrfToken ?? ""} />
      </head>
      <body className="bg-slate-950 text-slate-100">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-blue-600 focus:px-3 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <div className="preferences-root flex min-h-screen" data-theme="dark" data-accent="cyan" data-filter="standard">
          <aside className="w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col overflow-y-auto">
            <h1 className="text-2xl font-bold mb-8 text-white">
              Defence Intelligence
            </h1>

            <nav className="space-y-8 flex-1">
              {/* CORE SECTION */}
              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Core Intelligence</p>
                <div className="space-y-1">
                  <Link href="/map" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Global Atlas</Link>
                  <Link href="/" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Dashboard</Link>
                  <Link href="/countries" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Countries</Link>
                  <Link href="/companies" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Companies</Link>
                  <Link href="/contracts" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Contracts</Link>
                  <Link href="/equipment" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Capabilities</Link>
                  <Link href="/actors" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Non-State Actors</Link>
                </div>
              </div>

              {/* ANALYSIS SECTION */}
              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Strategic Analysis</p>
                <div className="space-y-1">
                  <Link href="/analytics" className="block py-1 px-2 rounded text-blue-400 hover:text-white hover:bg-blue-900/30 transition-all font-medium">Financial Analytics</Link>
                  <Link href="/analytics/corruption" className="block py-1 px-2 rounded text-red-400 hover:text-white hover:bg-red-900/30 transition-all font-medium">Corruption Index</Link>
                  <Link href="/conflict-tracker" className="block py-1 px-2 rounded text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-all font-medium">Conflict Tracker</Link>
                  <Link href="/hybrid-warfare" className="block py-1 px-2 rounded text-purple-400 hover:text-purple-300 hover:bg-purple-900/20 transition-all font-medium">Hybrid Warfare</Link>
                  <Link href="/intelligence" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Intelligence Feed</Link>
                  <Link href="/artificial-intelligence" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">AI in Defence</Link>
                  <Link href="/analysis/alignment" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Alignment Model</Link>
                  <Link href="/investigations" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Investigations</Link>
                  <Link href="/compare" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Benchmarks</Link>
                </div>
              </div>

              {/* MANAGEMENT SECTION */}
              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Asset Management</p>
                <div className="space-y-1">
                  <Link href="/procurement" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Procurement</Link>
                  <Link href="/programmes" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Programmes</Link>
                  <Link href="/exports" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Exports</Link>
                  <Link href="/sources" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Sources</Link>
                  <Link href="/watchlist" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Watchlist</Link>
                </div>
              </div>

              {/* PLATFORM SECTION */}
              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Platform</p>
                <div className="space-y-1">
                  <Link href="/account" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Account</Link>
                  <Link href="/pricing" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Pricing</Link>
                  <Link href="/admin" className="block py-1 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all">Admin Console</Link>
                </div>
              </div>
            </nav>

            <div className="pt-6 mt-auto border-t border-slate-800">
              <form action="/search" method="get" className="relative">
                <input
                  name="q"
                  placeholder="Search intelligence..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </form>
            </div>
          </aside>

          <main id="main-content" className="flex-1 p-8 overflow-y-auto">
            <div className="shell-toolbar">
              <AppearanceSettings />
            </div>
            {children}
            <div className="mt-8 border-t border-slate-800 pt-4">
              <UserSurvey />
            </div>
            <footer className="mt-12 border-t border-slate-800 pt-6 text-xs text-slate-500">
              <p>This service is not a Consumer Reporting Agency and may not be used for credit, employment, housing, or tenant screening.</p>
              <nav className="mt-3 flex flex-wrap gap-4">
                <Link href="/opt-out" className="hover:text-slate-300">Privacy opt-out</Link>
                <Link href="/terms" className="hover:text-slate-300">Terms</Link>
                <Link href="/acceptable-use" className="hover:text-slate-300">Acceptable use</Link>
                <Link href="/privacy" className="hover:text-slate-300">Privacy</Link>
                <Link href="/data-licences" className="hover:text-slate-300">Data licences</Link>
              </nav>
              <p className="mt-3">© {new Date().getFullYear()} Defence Intelligence Platform. Data sources are credited on the <Link href="/data-licences" className="underline hover:text-slate-300">licences page</Link>; nothing here is investment advice.</p>
            </footer>
          </main>

        </div>
      </body>
    </html>
  );
}
