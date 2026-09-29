import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Props = {
  countryId: number;
};

function label(value: string | null | undefined) {
  if (!value) return "Not specified";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function CountryProcurementSummary({
  countryId,
}: Props) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("procurement_events")
    .select(`
      id,
      event_type,
      event_date,
      title,
      description,
      importance,
      data_confidence,
      source_id,
      contracts (
        id,
        title
      )
    `)
    .eq("country_id", countryId)
    .order("event_date", { ascending: false })
    .limit(6);

  const events = data ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">
            Procurement
          </p>

          <h2 className="mt-2 text-xl font-semibold">
            Recent procurement activity
          </h2>
        </div>

        <Link
          href="/procurement"
          className="text-sm text-sky-400 hover:underline"
        >
          View procurement →
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
          <p className="text-sm text-slate-400">
            No procurement events are currently recorded for this country.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-180 text-left">
            <thead className="border-b border-slate-800 bg-slate-950">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Date
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Event
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Type
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Importance
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                    {event.event_date}
                  </td>

                  <td className="px-4 py-3">
                    {event.contracts?.[0]?.id ? (
                      <Link
                        href={`/contracts/${event.contracts[0].id}`}
                        className="text-sm font-medium text-slate-200 hover:text-sky-300 hover:underline"
                      >
                        {event.title}
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-200">
                        {event.title}
                      </span>
                    )}

                    {event.description && (
                      <p className="mt-1 max-w-xl text-xs text-slate-600">
                        {event.description}
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-3 text-sm text-slate-500">
                    {label(event.event_type)}
                  </td>

                  <td className="px-4 py-3 text-sm text-slate-500">
                    {label(event.importance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}