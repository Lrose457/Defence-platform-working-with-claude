"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { supabase } from "@/lib/supabase/supabase";
import FullscreenChart from "@/components/FullscreenChart";
import StockTicker from "@/components/StockTicker";

type CountryRow = { id: number; name: string; iso_code: string | null };
type BudgetRow = { country_id: number; year: number; amount_usd: number | null };
type StockQuote = { symbol: string; name: string; price: number | null; changePercent: number | null };

const SERIES_COLORS = [
  '#38bdf8', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#f97316', '#a3e635', '#60a5fa', '#fb7185', '#4ade80',
];

export default function AnalyticsPage() {
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [{ data: countryRows, error: cErr }, { data: budgetRows, error: bErr }] = await Promise.all([
          supabase.from("countries").select("id, name, iso_code").order("name"),
          supabase.from("budgets").select("country_id, year, amount_usd").gte("year", 2000).order("year"),
        ]);
        if (cErr) throw cErr;
        if (bErr) throw bErr;

        setCountries((countryRows ?? []) as CountryRow[]);
        setBudgets((budgetRows ?? []) as BudgetRow[]);

        try {
          const res = await fetch('/api/stocks');
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
          setQuotes((json.data ?? []) as StockQuote[]);
          setQuotesError(json.error ?? null);
        } catch {
          setQuotesError("Market data is unavailable right now.");
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Unable to load analytics data.");
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  /*
   * Every tracked country with any budget record appears; lines are
   * colored per country and listed in a legend. No hardcoded keys.
   */
  const countriesWithBudgets = useMemo(() => {
    const ids = new Set(budgets.map((b) => b.country_id));
    return countries.filter((c) => ids.has(c.id));
  }, [countries, budgets]);

  const years = useMemo(
    () => [...new Set(budgets.map((b) => b.year))].sort((a, b) => a - b),
    [budgets],
  );

  const spendingOverTime = useMemo(
    () =>
      years.map((year) => {
        const point: Record<string, string | number | null> = { year: String(year) };
        for (const country of countriesWithBudgets) {
          const row = budgets.find(
            (b) => b.country_id === country.id && b.year === year,
          );
          point[String(country.id)] =
            row?.amount_usd != null ? row.amount_usd / 1_000_000_000 : null;
        }
        return point;
      }),
    [years, countriesWithBudgets, budgets],
  );

  const topSpenders = useMemo(() => {
    const latest = new Map<number, number>();
    for (const b of budgets) {
      if (b.amount_usd == null) continue;
      const prev = latest.get(b.country_id) ?? 0;
      if (b.year >= 0 && b.amount_usd > prev) latest.set(b.country_id, b.amount_usd);
    }
    return [...latest.entries()]
      .map(([id, amount]) => ({ id, amount, name: countries.find((c) => c.id === id)?.name ?? `Country ${id}` }))
      .sort((a, b) => b.amount - a.amount);
  }, [budgets, countries]);

  if (isLoading) {
    return <p className="intel-empty-state">Loading financial intelligence…</p>;
  }

  if (loadError) {
    return (
      <div className="intel-surface intel-empty-state">
        <h2 className="text-lg font-semibold">Analytics unavailable</h2>
        <p className="mt-1 text-sm text-slate-400">
          Something went wrong loading spending data. Please try again later.
        </p>
      </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-end gap-3 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Financial Intelligence</h1>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Multi-dimensional analysis of global defence spending · {countriesWithBudgets.length} countries tracked
          </p>
        </div>
      </div>

      {countriesWithBudgets.length === 0 ? (
        <div className="intel-surface intel-empty-state">
          <h2 className="text-lg font-semibold">No budget data yet</h2>
          <p className="mt-1 text-sm text-slate-400">
            Spending charts appear once budget records are ingested.
          </p>
        </div>
      ) : (
        <FullscreenChart
          title="Defence spending trends (billion USD)"
          subtitle="Every tracked country with recorded budgets · source: national budgets via SIPRI"
          attribution="Source: SIPRI Military Expenditure Database"
        >
          <LineChart data={spendingOverTime}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="year" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#f1f5f9', fontSize: '12px', fontFamily: 'monospace' }}                formatter={(v) => (v == null ? "—" : `$${Number(v).toFixed(1)}bn`)}
            />
            <Legend wrapperStyle={{ fontSize: '10px', color: '#64748b' }} />
            {countriesWithBudgets.map((c, i) => (
              <Line
                key={c.id}
                type="monotone"
                dataKey={String(c.id)}
                name={c.name}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </FullscreenChart>
      )}

      {/* Market ticker + live stock graph (moved here from the global sidebar) */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Defence market</h2>
          {quotesError ? (
            <span className="text-[10px] font-mono text-amber-500">{quotesError}</span>
          ) : (
            <Link href="/stocks" className="text-[10px] font-mono text-blue-500 hover:underline">FULL TICKER &rarr;</Link>
          )}
        </div>

        <StockTicker refreshInterval={60_000} />

        {quotes.length > 0 && (
          <FullscreenChart
            title="Defence primes — daily % change"
            subtitle="Delayed quotes · not investment advice"
            attribution="Data: Finnhub (delayed)"
            initialHeight={260}
          >
            <LineChart data={quotes.map((q) => ({ name: q.symbol, change: q.changePercent }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} interval={0} angle={-35} textAnchor="end" height={50} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#f1f5f9', fontSize: '12px', fontFamily: 'monospace' }}
                formatter={(v) => (v == null ? "—" : `${Number(v).toFixed(2)}%`)}
              />
              <Line type="monotone" dataKey="change" stroke="#38bdf8" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </FullscreenChart>
        )}
      </section>

      <section className="intel-surface p-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Top spenders (latest recorded year)</h2>
        {topSpenders.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No budget records available.</p>
        ) : (
          <ol className="mt-3 space-y-1.5">
            {topSpenders.slice(0, 10).map((s, i) => (
              <li key={s.id} className="flex items-baseline gap-3 text-sm">
                <span className="w-6 font-mono text-xs text-slate-600">{String(i + 1).padStart(2, '0')}</span>
                <Link href={`/countries/${s.id}`} className="text-slate-300 hover:text-blue-400">{s.name}</Link>
                <span className="ml-auto font-mono text-green-400">${(s.amount / 1_000_000_000).toFixed(1)}bn</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="intel-methodology">
        All figures are shown as recorded in the underlying sources with no
        interpolation or projection. Years without a recorded value are left
        empty rather than estimated. Source attribution: SIPRI Military
        Expenditure Database.
      </p>
    </div>
  );
}
