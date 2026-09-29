import Link from "next/link";
import { supabase } from "@/lib/supabase/supabase";
import WatchButton from "@/components/WatchButton";
import EntityHistory from "@/components/EntityHistory";
import WatchlistButton from "@/components/WatchlistButton";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function confidenceClass(value: string | null) {
  switch (value?.toLowerCase()) {
    case "high":
      return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
    case "medium":
      return "border-amber-800 bg-amber-950/40 text-amber-300";
    case "low":
      return "border-red-800 bg-red-950/40 text-red-300";
    default:
      return "border-slate-700 bg-slate-950 text-slate-400";
  }
}

export default async function EquipmentPage({ params }: PageProps) {
  const { id } = await params;
  const equipmentId = Number(id);

  if (!Number.isInteger(equipmentId)) {
    return <p>Invalid equipment.</p>;
  }

  const { data: equipment, error } = await supabase
    .from("equipment")
    .select("*")
    .eq("id", equipmentId)
    .maybeSingle();

  if (error || !equipment) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Equipment not found</h1>
        <p className="text-slate-400">
          {error?.message || "This equipment record does not exist."}
        </p>
      </div>
    );
  }

  const [
    contractsResult,
    programmesResult,
    countriesResult,
  ] = await Promise.all([
    supabase
      .from("contract_equipment")
      .select("contract_id,quantity,notes")
      .eq("equipment_id", equipmentId),

    supabase
      .from("programme_equipment")
      .select("programme_id")
      .eq("equipment_id", equipmentId),

    supabase
      .from("country_equipment")
      .select(
        "country_id,quantity,acquisition_year,retirement_year,source_id,confidence"
      )
      .eq("equipment_id", equipmentId),
  ]);

  const contractLinks = contractsResult.data ?? [];
  const programmeLinks = programmesResult.data ?? [];
  const countryLinks = countriesResult.data ?? [];

  const contractIds = contractLinks.map((item) => item.contract_id);
  const programmeIds = programmeLinks.map((item) => item.programme_id);
  const countryIds = countryLinks.map((item) => item.country_id);

  const [
    { data: contracts },
    { data: programmes },
    { data: countries },
  ] = await Promise.all([
    contractIds.length
      ? supabase
          .from("contracts")
          .select("id,title,value,status,contract_date,company_id")
          .in("id", contractIds)
          .order("contract_date", {
            ascending: false,
            nullsFirst: false,
          })
      : Promise.resolve({ data: [] }),

    programmeIds.length
      ? supabase
          .from("programmes")
          .select("id,name,status,programme_type")
          .in("id", programmeIds)
          .order("name")
      : Promise.resolve({ data: [] }),

    countryIds.length
      ? supabase
          .from("countries")
          .select("id,name,iso_code,region")
          .in("id", countryIds)
          .order("name")
      : Promise.resolve({ data: [] }),
  ]);

  const manufacturerName =
    equipment.manufacturer || "Manufacturer not recorded";

  return (
    <div className="intel-page space-y-8">
      {/* Header */}
      <header>
        <div className="mb-4 text-sm text-slate-500">
          <Link href="/equipment" className="hover:text-slate-300">
            Equipment
          </Link>

          <span className="mx-2">/</span>

          {equipment.name}
        </div>

        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="intel-page-kicker">
              Equipment system
            </p>

            <h1 className="intel-page-title">
              {equipment.name}
            </h1>

            <div className="mt-4 flex flex-wrap gap-2">
              {equipment.category_id && (
                <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
                  Category {equipment.category_id}
                </span>
              )}

              {equipment.country_of_origin && (
                <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
                  {equipment.country_of_origin}
                </span>
              )}
            </div>
          </div>
<WatchlistButton
  entityType="equipment"
  entityId={equipment.id}
  entityName={equipment.name}
/>
          <WatchButton
            entityType="equipment"
            entityId={equipment.id}
            entityName={equipment.name}
          />
        </div>
      </header>

      {/* At a glance */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">At a glance</h2>

        <div className="intel-metrics md:grid-cols-4">
          <div className="intel-metric"><p className="intel-metric-label">Manufacturer</p>

            <p className="intel-metric-value">
              {manufacturerName}
            </p>
          </div>

          <div className="intel-surface p-5">
            <p className="text-sm text-slate-400">Countries recorded</p>

            <p className="mt-2 text-3xl font-bold">
              {countries?.length ?? 0}
            </p>
          </div>

          <div className="intel-surface p-5">
            <p className="text-sm text-slate-400">Programmes</p>

            <p className="mt-2 text-3xl font-bold">
              {programmes?.length ?? 0}
            </p>
          </div>

          <div className="intel-surface p-5">
            <p className="text-sm text-slate-400">Contracts</p>

            <p className="mt-2 text-3xl font-bold">
              {contracts?.length ?? 0}
            </p>
          </div>
        </div>
      </section>

      {/* Overview */}
      <section className="intel-surface p-6">
        <h2 className="text-xl font-semibold">
          Equipment overview
        </h2>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Manufacturer
            </p>

            <p className="mt-1 text-sm text-slate-200">
              {manufacturerName}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Country of origin
            </p>

            <p className="mt-1 text-sm text-slate-200">
              {equipment.country_of_origin || "Not recorded"}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Service entry
            </p>

            <p className="mt-1 text-sm text-slate-200">
              {equipment.service_entry_year || "Not recorded"}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Service exit
            </p>

            <p className="mt-1 text-sm text-slate-200">
              {equipment.service_exit_year || "Still in service / not recorded"}
            </p>
          </div>
        </div>
      </section>

      {/* Countries */}
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold">
            Countries and inventory
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Recorded holdings and, where available, historical acquisition
            information.
          </p>
        </div>

        {!countries?.length ? (
          <div className="intel-surface p-6">
            <p className="text-sm text-slate-400">
              No countries are currently linked to this equipment.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {countries.map((country) => {
              const link = countryLinks.find(
                (item) => item.country_id === country.id
              );

              return (
                <div
                  key={country.id}
                  className="intel-surface p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <Link
                        href={`/countries/${country.id}`}
                        className="font-semibold text-sky-400 hover:underline"
                      >
                        {country.name}
                      </Link>

                      {country.iso_code && (
                        <p className="mt-1 text-xs text-slate-500">
                          {country.iso_code}
                        </p>
                      )}
                    </div>

                    {link?.quantity != null && (
                      <div className="text-right">
                        <p className="text-xs text-slate-500">
                          Recorded quantity
                        </p>

                        <p className="mt-1 text-xl font-semibold">
                          {Number(link.quantity).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Acquisition
                      </p>

                      <p className="mt-1 text-sm text-slate-300">
                        {link?.acquisition_year || "Not recorded"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Retirement
                      </p>

                      <p className="mt-1 text-sm text-slate-300">
                        {link?.retirement_year || "Not recorded"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Confidence
                      </p>

                      <span
                        className={`mt-1 inline-block rounded-full border px-2.5 py-1 text-xs ${confidenceClass(
                          link?.confidence || null
                        )}`}
                      >
                        {link?.confidence || "Not assessed"}
                      </span>
                    </div>
                  </div>

                  {link?.source_id && (
                    <Link
                      href={`/sources/${link.source_id}`}
                      className="mt-4 inline-block text-sm text-sky-400 hover:underline"
                    >
                      View supporting source
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Contracts */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">
          Associated contracts
        </h2>

        {!contracts?.length ? (
          <div className="intel-surface p-6">
            <p className="text-sm text-slate-400">
              No contracts are currently linked to this equipment.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {contracts.map((contract) => {
              const link = contractLinks.find(
                (item) => item.contract_id === contract.id
              );

              return (
                <Link
                  key={contract.id}
                  href={`/contracts/${contract.id}`}
                  className="intel-surface block p-5 transition hover:border-sky-800"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">
                        {contract.title || `Contract ${contract.id}`}
                      </h3>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {contract.status && (
                          <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-400">
                            {contract.status}
                          </span>
                        )}

                        {contract.contract_date && (
                          <span className="text-xs text-slate-500">
                            {new Date(
                              contract.contract_date
                            ).toLocaleDateString("en-GB")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      {contract.value != null && (
                        <p className="font-semibold">
                          {Number(contract.value).toLocaleString()}
                        </p>
                      )}

                      {link?.quantity != null && (
                        <p className="mt-1 text-xs text-slate-500">
                          Quantity:{" "}
                          {Number(link.quantity).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Programmes */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">
          Associated programmes
        </h2>

        {!programmes?.length ? (
          <div className="intel-surface p-6">
            <p className="text-sm text-slate-400">
              No programmes are currently linked to this equipment.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {programmes.map((programme) => (
              <Link
                key={programme.id}
                href={`/programmes/${programme.id}`}
                className="intel-surface block p-5 transition hover:border-sky-800"
              >
                <h3 className="font-semibold">
                  {programme.name}
                </h3>

                {programme.programme_type && (
                  <p className="mt-1 text-sm text-slate-400">
                    {programme.programme_type}
                  </p>
                )}

                {programme.status && (
                  <p className="mt-2 text-xs text-slate-500">
                    {programme.status}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* History */}
      <EntityHistory
        entityType="equipment"
        entityId={equipment.id}
      />

      {/* Methodology */}
      <section className="intel-surface p-6">
        <h2 className="text-lg font-semibold">
          About this equipment profile
        </h2>

        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
          Equipment holdings represent records currently associated with a
          country in the platform. Acquisition and retirement dates are only
          shown when recorded. Quantities should not be interpreted as
          operational availability unless the underlying source explicitly
          supports that conclusion.
        </p>
      </section>
    </div>
  );
}
