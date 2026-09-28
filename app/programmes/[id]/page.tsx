import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WatchButton from "@/components/WatchButton";
import AlertButton from "@/components/AlertButton";
import EntityHistory from "@/components/EntityHistory";

import ProgrammeIntelligenceSummary from "@/components/ProgrammeIntelligenceSummary";
type Props = {
  params: Promise<{ id: string }>;
};

type EquipmentRecord = {
  id: number;
  name: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatValue(
  value: number | null | undefined,
  currency?: string | null,
) {
  if (value === null || value === undefined) {
    return "Not recorded";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "Not recorded";
  }

  return `${currency ? `${currency} ` : ""}${amount.toLocaleString()}`;
}

export default async function ProgrammePage({ params }: Props) {
  const { id } = await params;
  const programmeId = Number(id);

  if (!Number.isFinite(programmeId)) {
    notFound();
  }

  const supabase = await createClient();

  const [
    programmeResult,
    contractsResult,
    procurementResult,
    changesResult,
    participantsResult,
  ] = await Promise.all([
    supabase
      .from("programmes")
      .select("*")
      .eq("id", programmeId)
      .single(),

    supabase
      .from("contracts")
      .select(
        "id,title,value,currency,status,contract_date,announced_date,award_date,delivery_start_date,delivery_end_date,country_id,company_id,programme_id,source_id,data_confidence",
      )
      .eq("programme_id", programmeId)
      .order("contract_date", { ascending: false }),

    supabase
      .from("procurement_events")
      .select(
        "id,event_type,event_date,title,description,source_id,data_confidence,importance,contract_id",
      )
      .eq("programme_id", programmeId)
      .order("event_date", { ascending: false })
      .limit(15),

    supabase
      .from("data_changes")
      .select(
        "id,field_name,old_value,new_value,change_type,changed_at,reason,importance,severity,source_id",
      )
      .eq("entity_type", "programme")
      .eq("entity_id", programmeId)
      .eq("intelligence_eligible", true)
      .neq("field_name", "record_created")
      .order("changed_at", { ascending: false })
      .limit(15),

    supabase
      .from("country_programmes")
      .select("country_id, role, countries ( id, name, iso_code )")
      .eq("programme_id", programmeId),
  ]);

  if (programmeResult.error || !programmeResult.data) {
    notFound();
  }

  const programme = programmeResult.data;
  const contracts = contractsResult.data || [];
  const procurementEvents = procurementResult.data || [];
  const changes = changesResult.data || [];
  const participants = (participantsResult.data ?? []).map((p) => {
    /* Supabase types the many-to-one embed as an array; PostgREST returns
     * an object at runtime — normalise to the object form. */
    const c = Array.isArray(p.countries) ? (p.countries[0] ?? null) : p.countries;
    return {
      country_id: p.country_id as number,
      role: (p.role ?? null) as string | null,
      countries: (c ?? null) as { id: number; name: string; iso_code: string | null } | null,
    };
  });

  const equipmentIdsResult = await supabase
    .from("contract_equipment")
    .select("equipment_id")
    .in(
      "contract_id",
      contracts.map((contract) => contract.id).length
        ? contracts.map((contract) => contract.id)
        : [0],
    );

  const equipmentIds = Array.from(
    new Set(
      (equipmentIdsResult.data || [])
        .map((row) => row.equipment_id)
        .filter(Boolean),
    ),
  );

  let equipment: EquipmentRecord[] = [];

  if (equipmentIds.length > 0) {
    const equipmentResult = await supabase
      .from("equipment")
      .select("id,name")
      .in("id", equipmentIds);

    equipment = equipmentResult.data || [];
  }

  return (
    <div className="intel-page space-y-8">
      {/* HEADER */}

      <section>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="intel-page-kicker">
              Programme Intelligence
            </p>

            <h1 className="intel-page-title">
              {programme.name}
            </h1>

            <p className="intel-page-description">
              Defence programme profile connecting procurement,
              contracts, equipment and source-backed intelligence.
            </p>
          </div>

          <div className="intel-entity-actions">
            <WatchButton
              entityType="programme"
              entityId={programme.id}
              entityName={programme.name}
            />

            <AlertButton
              entityType="programme"
              entityId={programme.id}
              entityName={programme.name}
            />
          </div>
        </div>
        <ProgrammeIntelligenceSummary programmeId={programme.id} />
      </section>

      {/* PROGRAMME PROFILE */}

      <section className="rounded-lg border border-(--border) bg-(--surface) p-5">
        <h2 className="text-sm font-semibold">
          Programme profile
        </h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-(--foreground-muted)">
              Programme type
            </p>

            <p className="mt-1 text-sm">
              {programme.programme_type || "Not recorded"}
            </p>
          </div>

          <div>
            <p className="text-xs text-(--foreground-muted)">
              Start date
            </p>

            <p className="mt-1 text-sm">
              {formatDate(programme.start_date)}
            </p>
          </div>

          <div>
            <p className="text-xs text-(--foreground-muted)">
              Expected completion
            </p>

            <p className="mt-1 text-sm">
              {formatDate(
                programme.expected_completion_date,
              )}
            </p>
          </div>

          <div>
            <p className="text-xs text-(--foreground-muted)">
              Programme budget
            </p>

            <p className="mt-1 text-sm">
              {formatValue(
                programme.budget_value,
                programme.currency,
              )}
            </p>
          </div>

          <div>
            <p className="text-xs text-(--foreground-muted)">
              Data confidence
            </p>

            <p className="mt-1 text-sm">
              {programme.data_confidence ||
                "Not recorded"}
            </p>
          </div>
        </div>

        {programme.description && (
          <div className="mt-6 border-t border-(--border) pt-5">
            <p className="text-xs text-(--foreground-muted)">
              Description
            </p>

            <p className="mt-2 max-w-4xl text-sm leading-6">
              {programme.description}
            </p>
          </div>
        )}
      </section>

      {/* PARTICIPANTS */}

      <section className="rounded-lg border border-(--border) bg-(--surface)">
        <div className="border-b border-(--border) px-5 py-4">
          <h2 className="text-sm font-semibold">
            Participating countries
          </h2>

          <p className="mt-1 text-xs text-(--foreground-muted)">
            Nations recorded in this programme, with lead/participant roles.
          </p>
        </div>

        {participants.length === 0 ? (
          <div className="p-5 text-sm text-(--foreground-muted)">
            No participating countries are currently recorded.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 px-5 py-4">
            {participants.map((p) => (
              <Link
                key={p.country_id}
                href={`/countries/${p.country_id}`}
                className="rounded border border-(--border) px-3 py-1.5 text-xs hover:bg-(--surface-hover)"
              >
                {p.countries?.name ?? `Country ${p.country_id}`}
                {p.countries?.iso_code ? ` (${p.countries.iso_code})` : ""}
                {p.role === "lead" ? " · lead" : ""}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* EQUIPMENT */}

      <section className="rounded-lg border border-(--border) bg-(--surface)">
        <div className="border-b border-(--border) px-5 py-4">
          <h2 className="text-sm font-semibold">
            Connected equipment
          </h2>

          <p className="mt-1 text-xs text-(--foreground-muted)">
            Equipment associated through programme contracts.
          </p>
        </div>

        {equipment.length === 0 ? (
          <div className="p-5 text-sm text-(--foreground-muted)">
            No connected equipment is currently recorded.
          </div>
        ) : (
          <div className="divide-y divide-(--border)">
            {equipment.map((item) => (
              <Link
                key={item.id}
                href={`/equipment/${item.id}`}
                className="block px-5 py-4 transition hover:bg-(--surface-hover)"
              >
                <p className="text-sm font-medium">
                  {item.name}
                </p>

                <p className="mt-1 text-xs text-blue-400">
                  View equipment intelligence →
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* CONTRACTS */}

      <section className="rounded-lg border border-(--border) bg-(--surface)">
        <div className="border-b border-(--border) px-5 py-4">
          <h2 className="text-sm font-semibold">
            Programme contracts
          </h2>
        </div>

        {contracts.length === 0 ? (
          <div className="p-5 text-sm text-(--foreground-muted)">
            No contracts are currently linked to this programme.
          </div>
        ) : (
          <div className="divide-y divide-(--border)">
            {contracts.map((contract) => (
              <Link
                key={contract.id}
                href={`/contracts/${contract.id}`}
                className="block px-5 py-4 transition hover:bg-(--surface-hover)"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {contract.title ||
                        `Contract ${contract.id}`}
                    </p>

                    <p className="mt-1 text-xs text-(--foreground-muted)">
                      {contract.status ||
                        "Status not recorded"}
                      {" · "}
                      {formatDate(contract.contract_date)}
                    </p>
                  </div>

                  <p className="text-sm font-semibold">
                    {formatValue(
                      contract.value,
                      contract.currency,
                    )}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* PROCUREMENT */}

      <section className="rounded-lg border border-(--border) bg-(--surface)">
        <div className="border-b border-(--border) px-5 py-4">
          <h2 className="text-sm font-semibold">
            Procurement activity
          </h2>
        </div>

        {procurementEvents.length === 0 ? (
          <div className="p-5 text-sm text-(--foreground-muted)">
            No procurement events are currently recorded.
          </div>
        ) : (
          <div className="divide-y divide-(--border)">
            {procurementEvents.map((event) => (
              <div key={event.id} className="px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {event.title}
                    </p>

                    <p className="mt-1 text-xs text-(--foreground-muted)">
                      {event.event_type}
                      {" · "}
                      {formatDate(event.event_date)}
                    </p>

                    {event.description && (
                      <p className="mt-2 text-xs leading-5 text-(--foreground-muted)">
                        {event.description}
                      </p>
                    )}
                  </div>

                  {event.importance && (
                    <span className="h-fit rounded border border-(--border) px-2 py-1 text-[10px] uppercase tracking-wide">
                      {event.importance}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* INTELLIGENCE */}

      <section className="rounded-lg border border-(--border) bg-(--surface)">
        <div className="border-b border-(--border) px-5 py-4">
          <h2 className="text-sm font-semibold">
            Recent intelligence changes
          </h2>
        </div>

        {changes.length === 0 ? (
          <div className="p-5 text-sm text-(--foreground-muted)">
            No intelligence changes are currently recorded.
          </div>
        ) : (
          <div className="divide-y divide-(--border)">
            {changes.map((change) => (
              <div key={change.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  {change.importance && (
                    <span className="rounded border border-(--border) px-2 py-1 text-[10px] uppercase">
                      {change.importance}
                    </span>
                  )}

                  {change.severity && (
                    <span className="text-[10px] uppercase text-(--foreground-muted)">
                      {change.severity}
                    </span>
                  )}

                  <span className="text-[10px] text-(--foreground-muted)">
                    {formatDate(change.changed_at)}
                  </span>
                </div>

                <p className="mt-2 text-sm font-medium">
                  {change.field_name
                    ? change.field_name.replace(/_/g, " ")
                    : "Record update"}
                </p>

                {change.reason && (
                  <p className="mt-1 text-xs leading-5 text-(--foreground-muted)">
                    {change.reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <EntityHistory
        entityType="programme"
        entityId={programme.id}
      />

      <div className="flex flex-wrap gap-4">
        <Link
          href="/programmes"
          className="text-xs text-blue-400 hover:underline"
        >
          ← All programmes
        </Link>

        <Link
          href="/search"
          className="text-xs text-blue-400 hover:underline"
        >
          Search platform →
        </Link>
      </div>
    </div>
  );
}
