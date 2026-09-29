import Link from "next/link";
import { supabase } from "@/lib/supabase/supabase";

export default async function NewIntelligencePage() {
  const [
    countriesResult,
    companiesResult,
    equipmentResult,
    programmesResult,
    contractsResult,
    budgetsResult,
    sourcesResult,
  ] = await Promise.all([
    supabase.from("countries").select("id,name").order("name"),
    supabase.from("companies").select("id,name").order("name"),
    supabase.from("equipment").select("id,name").order("name"),
    supabase.from("programmes").select("id,name").order("name"),
    supabase.from("contracts").select("id,title").order("title"),
    supabase
      .from("budgets")
      .select("id,year")
      .order("year", { ascending: false }),
    supabase
      .from("sources")
      .select("id,title,publisher")
      .order("publication_date", {
        ascending: false,
        nullsFirst: false,
      }),
  ]);

  const countries = countriesResult.data ?? [];
  const companies = companiesResult.data ?? [];
  const equipment = equipmentResult.data ?? [];
  const programmes = programmesResult.data ?? [];
  const contracts = contractsResult.data ?? [];
  const budgets = budgetsResult.data ?? [];
  const sources = sourcesResult.data ?? [];

  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <div className="mb-4 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-300">
            Overview
          </Link>

          <span className="mx-2">/</span>

          <Link
            href="/intelligence"
            className="hover:text-slate-300"
          >
            Analyst Console
          </Link>

          <span className="mx-2">/</span>

          New intelligence
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
          Internal research workflow
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          Record intelligence
        </h1>

        <p className="mt-3 max-w-3xl text-slate-400">
          Record a verified, source-backed development for an existing entity.
        </p>
      </div>

      {/* Notice */}
      <div className="rounded-xl border border-sky-900 bg-sky-950/30 p-5">
        <h2 className="font-semibold text-sky-200">
          Analyst-only workflow
        </h2>

        <p className="mt-2 text-sm leading-6 text-sky-100/70">
          Use this form when you have reviewed a source and decided that a
          development should become part of the platform&apos;s curated
          intelligence dataset.
        </p>

        <p className="mt-2 text-sm leading-6 text-sky-100/70">
          Routine database maintenance should not be entered here.
        </p>
      </div>

      {/* Form */}
      <div className="intel-surface p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">
            Intelligence record
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            A supporting source is required.
          </p>
        </div>

        <form
          action="/api/intelligence"
          method="POST"
          className="space-y-6"
        >
          {/* Entity */}
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label
                htmlFor="entity_type"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Entity type
              </label>

              <select
                id="entity_type"
                name="entity_type"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-200"
              >
                <option value="">Select type</option>
                <option value="country">Country</option>
                <option value="company">Company</option>
                <option value="equipment">Equipment</option>
                <option value="programme">Programme</option>
                <option value="contract">Contract</option>
                <option value="budget">Budget</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="entity_id"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Entity
              </label>

              <select
                id="entity_id"
                name="entity_id"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-200"
              >
                <option value="">Select entity</option>

                <optgroup label="Countries">
                  {countries.map((item) => (
                    <option
                      key={`country-${item.id}`}
                      value={`country:${item.id}`}
                    >
                      {item.name}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="Companies">
                  {companies.map((item) => (
                    <option
                      key={`company-${item.id}`}
                      value={`company:${item.id}`}
                    >
                      {item.name}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="Equipment">
                  {equipment.map((item) => (
                    <option
                      key={`equipment-${item.id}`}
                      value={`equipment:${item.id}`}
                    >
                      {item.name}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="Programmes">
                  {programmes.map((item) => (
                    <option
                      key={`programme-${item.id}`}
                      value={`programme:${item.id}`}
                    >
                      {item.name}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="Contracts">
                  {contracts.map((item) => (
                    <option
                      key={`contract-${item.id}`}
                      value={`contract:${item.id}`}
                    >
                      {item.title || `Contract ${item.id}`}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="Budgets">
                  {budgets.map((item) => (
                    <option
                      key={`budget-${item.id}`}
                      value={`budget:${item.id}`}
                    >
                      Budget {item.year}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Change */}
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label
                htmlFor="field_name"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                What changed?
              </label>

              <input
                id="field_name"
                name="field_name"
                required
                placeholder="e.g. Status"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-200 placeholder:text-slate-600"
              />

              <p className="mt-2 text-xs text-slate-500">
                Examples: Status, Quantity, Delivery date, Contract value.
              </p>
            </div>

            <div>
              <label
                htmlFor="change_date"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Date of development
              </label>

              <input
                id="change_date"
                name="change_date"
                type="date"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-200"
              />
            </div>
          </div>

          {/* Values */}
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label
                htmlFor="old_value"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Previous value
              </label>

              <textarea
                id="old_value"
                name="old_value"
                rows={3}
                placeholder="What was previously recorded?"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-200 placeholder:text-slate-600"
              />
            </div>

            <div>
              <label
                htmlFor="new_value"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                New value
              </label>

              <textarea
                id="new_value"
                name="new_value"
                rows={3}
                placeholder="What is now reported?"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-200 placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Source */}
          <div>
            <label
              htmlFor="source_id"
              className="mb-2 block text-sm font-medium text-slate-200"
            >
              Supporting source
            </label>

            <select
              id="source_id"
              name="source_id"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-200"
            >
              <option value="">Select source</option>

              {sources.map((source) => (
                <option
                  key={source.id}
                  value={source.id}
                >
                  {source.title}
                  {source.publisher
                    ? ` — ${source.publisher}`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Assessment */}
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <label
                htmlFor="data_confidence"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Confidence
              </label>

              <select
                id="data_confidence"
                name="data_confidence"
                defaultValue="Medium"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-200"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="importance"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Importance
              </label>

              <select
                id="importance"
                name="importance"
                defaultValue="normal"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-200"
              >
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="entry_method"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Entry method
              </label>

              <select
                id="entry_method"
                name="entry_method"
                defaultValue="Analyst entry"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-200"
              >
                <option value="Analyst entry">
                  Analyst entry
                </option>

                <option value="Source update">
                  Source update
                </option>

                <option value="Research update">
                  Research update
                </option>
              </select>
            </div>
          </div>

          {/* Assessment */}
          <div>
            <label
              htmlFor="reason"
              className="mb-2 block text-sm font-medium text-slate-200"
            >
              Assessment
            </label>

            <textarea
              id="reason"
              name="reason"
              required
              rows={4}
              placeholder="Explain what the source reports and why the platform record should change."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-200 placeholder:text-slate-600"
            />
          </div>

          {/* Notes */}
          <details className="rounded-lg border border-slate-800 bg-slate-950/50">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-300">
              Optional analyst notes
            </summary>

            <div className="p-4">
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Additional context, caveats or research notes."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-200 placeholder:text-slate-600"
              />
            </div>
          </details>

          {/* Submit */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-6">
            <p className="max-w-2xl text-xs leading-5 text-slate-500">
              This creates a source-backed intelligence record. It does not
              automatically modify the underlying entity.
            </p>

            <button
              type="submit"
              className="rounded-lg bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-400"
            >
              Record intelligence
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}