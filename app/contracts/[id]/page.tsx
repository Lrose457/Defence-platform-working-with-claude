import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import WatchButton from "@/components/WatchButton";
import AlertButton from "@/components/AlertButton";
import EntityHistory from "@/components/EntityHistory";

type PageProps = {
  params: Promise<{ id: string }>;
};

type ContractEquipment = {
  id: number;
  quantity: number | null;
  notes: string | null;
  equipment: { id: number; name: string } | { id: number; name: string }[] | null;
};

type ProcurementEvent = {
  id: number;
  event_date: string | null;
  title: string;
  description: string | null;
  importance: string | null;
  data_confidence: string | null;
  sources: { id: number; title: string } | { id: number; title: string }[] | null;
};

type ContractChange = {
  id: number;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  change_date: string | null;
  changed_at: string | null;
  summary: string | null;
  assessment: string | null;
  importance: string | null;
  severity: string | null;
  data_confidence: string | null;
  sources: { id: number; title: string } | { id: number; title: string }[] | null;
};

function formatCurrency(value: unknown, currency = "USD") {
  if (value === null || value === undefined || value === "") return "Unknown";

  const number = Number(value);

  if (!Number.isFinite(number)) return String(value);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(number);
}

function formatDate(value: unknown) {
  if (!value) return "Unknown";

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function label(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Unknown";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function confidenceClass(value: unknown) {
  const normalized = String(value ?? "").toLowerCase();

  if (normalized.includes("high") || normalized.includes("very")) {
    return "intel-badge intel-badge-positive";
  }

  if (normalized.includes("low")) {
    return "intel-badge intel-badge-warning";
  }

  return "intel-badge";
}

export default async function ContractDetailPage({ params }: PageProps) {
  const { id } = await params;

  const contractId = Number(id);

  if (!Number.isFinite(contractId)) {
    notFound();
  }

    const supabase = await createClient();

  const { data: contract, error } = await supabase
    .from("contracts")
    .select(`
      *,
      companies (
        id,
        name,
        headquarters_country
      ),
      programmes (
        id,
        name
      )
    `)
    .eq("id", contractId)
    .single();

  if (error || !contract) {
    notFound();
  }

  const company = Array.isArray(contract.companies)
    ? contract.companies[0]
    : contract.companies;

  // Fetch country separately to avoid ambiguous relationship embedding
  const countryId = contract.country_id;
  const { data: countryData } = countryId
    ? await supabase
        .from("countries")
        .select("id, name, iso_code")
        .eq("id", Number(countryId))
        .single()
    : { data: null as null };

  const country = countryData;

  const programme = Array.isArray(contract.programmes)
    ? contract.programmes[0]
    : contract.programmes;

  const [
    equipmentResult,
    eventsResult,
    changesResult,
    sourceResult,
  ] = await Promise.all([
    supabase
      .from("contract_equipment")
      .select(`
        id,
        quantity,
        notes,
        equipment (
          id,
          name
        )
      `)
      .eq("contract_id", contractId),

    supabase
      .from("procurement_events")
      .select(`
        id,
        event_type,
        event_date,
        title,
        description,
        data_confidence,
        importance,
        source_id,
        sources (
          id,
          title,
          publisher,
          publication_date,
          reliability
        )
      `)
      .eq("contract_id", contractId)
      .order("event_date", { ascending: true }),

    supabase
      .from("data_changes")
      .select(`
        id,
        field_name,
        old_value,
        new_value,
        change_date,
        changed_at,
        summary,
        assessment,
        importance,
        severity,
        data_confidence,
        reviewed,
        source_id,
        sources (
          id,
          title,
          publisher
        )
      `)
      .eq("entity_type", "contract")
      .eq("entity_id", contractId)
      .eq("intelligence_eligible", true)
      .neq("field_name", "record_created")
      .order("changed_at", { ascending: false })
      .limit(50),

    contract.source_id
      ? supabase
          .from("sources")
          .select(`
            id,
            title,
            publisher,
            publication_date,
            source_type,
            reliability,
            source_category,
            reliability_score,
            verification_status,
            last_verified_at,
            url,
            notes
          `)
          .eq("id", contract.source_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const equipment = equipmentResult.data ?? [];
  const procurementEvents = eventsResult.data ?? [];
  const changes = changesResult.data ?? [];
  const source = sourceResult.data;

  const currency = contract.currency || "USD";

  const totalEquipmentQuantity = equipment.reduce(
    (total: number, item: ContractEquipment) => {
      const quantity = Number(item.quantity);
      return Number.isFinite(quantity) ? total + quantity : total;
    },
    0,
  );

  return (
    <main className="intel-page">
      <div className="intel-page-header">
        <div className="intel-page-kicker">Contract Intelligence</div>

        <div className="intel-page-header-row">
          <div>
            <h1 className="intel-page-title">
              {contract.title || "Untitled Contract"}
            </h1>

            <p className="intel-page-description">
              Procurement record covering what was bought, who supplied it,
              the associated programme, timeline, value and supporting
              evidence.
            </p>
          </div>

          <div className="intel-page-actions">
            <WatchButton
              entityType="contract"
              entityId={contract.id}
              entityName={contract.title || "Untitled Contract"}
            />

            <AlertButton
              entityType="contract"
              entityId={contract.id}
              entityName={contract.title || "Untitled Contract"}
            />
          </div>
        </div>
      </div>

      <section className="intel-metrics" aria-label="Contract summary">
        <div className="intel-metric">
          <span className="intel-metric-label">Contract value</span>
          <strong className="intel-metric-value">
            {formatCurrency(contract.value, currency)}
          </strong>
        </div>

        <div className="intel-metric">
          <span className="intel-metric-label">Company</span>
          <strong className="intel-metric-value">
            {company?.name || "Unknown"}
          </strong>
        </div>

        <div className="intel-metric">
          <span className="intel-metric-label">Programme</span>
          <strong className="intel-metric-value">
            {programme?.name || "Unknown"}
          </strong>
        </div>

        <div className="intel-metric">
          <span className="intel-metric-label">Equipment quantity</span>
          <strong className="intel-metric-value">
            {totalEquipmentQuantity > 0
              ? totalEquipmentQuantity.toLocaleString("en-GB")
              : "Unknown"}
          </strong>
        </div>
      </section>

      <div className="intel-grid">
        <section className="intel-panel">
          <div className="intel-panel-header">
            <div>
              <div className="intel-panel-kicker">Record</div>
              <h2 className="intel-panel-title">Contract overview</h2>
            </div>
          </div>

          <div className="intel-panel-body">
            <dl className="intel-data-list">
              <div className="intel-data-row">
                <dt>Status</dt>
                <dd>{label(contract.status)}</dd>
              </div>

              <div className="intel-data-row">
                <dt>Contract type</dt>
                <dd>{label(contract.contract_type)}</dd>
              </div>

              <div className="intel-data-row">
                <dt>Procurement method</dt>
                <dd>{label(contract.procurement_method)}</dd>
              </div>

              <div className="intel-data-row">
                <dt>Procurement stage</dt>
                <dd>{label(contract.procurement_stage)}</dd>
              </div>

              <div className="intel-data-row">
                <dt>Country</dt>
                <dd>
                  {country ? (
                    <Link href={`/countries/${country.id}`}>
                      {country.name}
                    </Link>
                  ) : (
                    "Unknown"
                  )}
                </dd>
              </div>

              <div className="intel-data-row">
                <dt>Company</dt>
                <dd>
                  {company ? (
                    <Link href={`/companies/${company.id}`}>
                      {company.name}
                    </Link>
                  ) : (
                    "Unknown"
                  )}
                </dd>
              </div>

              <div className="intel-data-row">
                <dt>Programme</dt>
                <dd>
                  {programme ? (
                    <Link href={`/programmes/${programme.id}`}>
                      {programme.name}
                    </Link>
                  ) : (
                    "Unknown"
                  )}
                </dd>
              </div>

              <div className="intel-data-row">
                <dt>Contract date</dt>
                <dd>{formatDate(contract.contract_date)}</dd>
              </div>

              <div className="intel-data-row">
                <dt>Announced</dt>
                <dd>{formatDate(contract.announced_date)}</dd>
              </div>

              <div className="intel-data-row">
                <dt>Awarded</dt>
                <dd>{formatDate(contract.award_date)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="intel-panel">
          <div className="intel-panel-header">
            <div>
              <div className="intel-panel-kicker">Financial</div>
              <h2 className="intel-panel-title">Contract value</h2>
            </div>
          </div>

          <div className="intel-panel-body">
            <div className="intel-primary-value">
              {formatCurrency(contract.value, currency)}
            </div>

            <dl className="intel-data-list">
              <div className="intel-data-row">
                <dt>Currency</dt>
                <dd>{currency}</dd>
              </div>

              <div className="intel-data-row">
                <dt>Known value</dt>
                <dd>{contract.value != null ? "Yes" : "No"}</dd>
              </div>

              <div className="intel-data-row">
                <dt>Confidence</dt>
                <dd>
                  <span className={confidenceClass(contract.data_confidence)}>
                    {label(contract.data_confidence)}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </div>

      <section className="intel-panel">
        <div className="intel-panel-header">
          <div>
            <div className="intel-panel-kicker">Delivery</div>
            <h2 className="intel-panel-title">Delivery information</h2>
          </div>
        </div>

        <div className="intel-panel-body">
          <dl className="intel-data-list">
            <div className="intel-data-row">
              <dt>Delivery start</dt>
              <dd>{formatDate(contract.delivery_start_date)}</dd>
            </div>

            <div className="intel-data-row">
              <dt>Delivery end</dt>
              <dd>{formatDate(contract.delivery_end_date)}</dd>
            </div>

            <div className="intel-data-row">
              <dt>Delivery location</dt>
              <dd>{contract.delivery_location || "Unknown"}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="intel-panel">
        <div className="intel-panel-header">
          <div>
            <div className="intel-panel-kicker">Equipment</div>
            <h2 className="intel-panel-title">Equipment associated with contract</h2>
          </div>

          <span className="intel-badge">
            {equipment.length} system{equipment.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="intel-panel-body">
          {equipment.length === 0 ? (
            <p className="intel-empty">
              No equipment has been directly associated with this contract.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="intel-table">
                <caption className="sr-only">
                  Equipment associated with this contract
                </caption>

                <thead>
                  <tr>
                    <th scope="col">Equipment</th>
                    <th scope="col">Quantity</th>
                    <th scope="col">Notes</th>
                  </tr>
                </thead>

                <tbody>
                  {equipment.map((item: ContractEquipment) => {
                    const equipmentRecord = Array.isArray(item.equipment)
                      ? item.equipment[0]
                      : item.equipment;

                    return (
                      <tr key={item.id}>
                        <td>
                          {equipmentRecord ? (
                            <Link
                              href={`/equipment/${equipmentRecord.id}`}
                            >
                              {equipmentRecord.name}
                            </Link>
                          ) : (
                            "Unknown"
                          )}
                        </td>

                        <td>
                          {item.quantity != null
                            ? Number(item.quantity).toLocaleString("en-GB")
                            : "Unknown"}
                        </td>

                        <td>{item.notes || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="intel-panel">
        <div className="intel-panel-header">
          <div>
            <div className="intel-panel-kicker">Procurement</div>
            <h2 className="intel-panel-title">Procurement timeline</h2>
          </div>
        </div>

        <div className="intel-panel-body">
          {procurementEvents.length === 0 ? (
            <p className="intel-empty">
              No procurement events are currently recorded for this contract.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="intel-table">
                <caption className="sr-only">
                  Procurement events associated with this contract
                </caption>

                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Event</th>
                    <th scope="col">Importance</th>
                    <th scope="col">Confidence</th>
                    <th scope="col">Source</th>
                  </tr>
                </thead>

                <tbody>
                  {procurementEvents.map((event: ProcurementEvent) => {
                    const eventSource = Array.isArray(event.sources)
                      ? event.sources[0]
                      : event.sources;

                    return (
                      <tr key={event.id}>
                        <td>{formatDate(event.event_date)}</td>

                        <td>
                          <strong>{event.title}</strong>

                          {event.description && (
                            <div className="intel-table-secondary">
                              {event.description}
                            </div>
                          )}
                        </td>

                        <td>
                          <span className="intel-badge">
                            {label(event.importance)}
                          </span>
                        </td>

                        <td>
                          <span className={confidenceClass(event.data_confidence)}>
                            {label(event.data_confidence)}
                          </span>
                        </td>

                        <td>
                          {eventSource ? (
                            <Link href={`/sources/${eventSource.id}`}>
                              {eventSource.title}
                            </Link>
                          ) : (
                            "Unknown"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="intel-panel">
        <div className="intel-panel-header">
          <div>
            <div className="intel-panel-kicker">Evidence</div>
            <h2 className="intel-panel-title">Primary source</h2>
          </div>
        </div>

        <div className="intel-panel-body">
          {!source ? (
            <p className="intel-empty">
              No primary source is currently attached to this contract.
            </p>
          ) : (
            <dl className="intel-data-list">
              <div className="intel-data-row">
                <dt>Source</dt>
                <dd>
                  <Link href={`/sources/${source.id}`}>
                    {source.title}
                  </Link>
                </dd>
              </div>

              <div className="intel-data-row">
                <dt>Publisher</dt>
                <dd>{source.publisher || "Unknown"}</dd>
              </div>

              <div className="intel-data-row">
                <dt>Publication date</dt>
                <dd>{formatDate(source.publication_date)}</dd>
              </div>

              <div className="intel-data-row">
                <dt>Reliability</dt>
                <dd>{label(source.reliability)}</dd>
              </div>

              <div className="intel-data-row">
                <dt>Verification</dt>
                <dd>{label(source.verification_status)}</dd>
              </div>

              <div className="intel-data-row">
                <dt>Last verified</dt>
                <dd>{formatDate(source.last_verified_at)}</dd>
              </div>

              {source.url && (
                <div className="intel-data-row">
                  <dt>External source</dt>
                  <dd>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open source
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </section>

      <section className="intel-panel">
        <div className="intel-panel-header">
          <div>
            <div className="intel-panel-kicker">Intelligence</div>
            <h2 className="intel-panel-title">Record history</h2>
          </div>

          <span className="intel-badge">
            {changes.length} change{changes.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="intel-panel-body">
          {changes.length === 0 ? (
            <p className="intel-empty">
              No intelligence-eligible historical changes are currently
              recorded for this contract.
            </p>
          ) : (
            <div className="intel-history">
              {changes.map((change: ContractChange) => {
                const changeSource = Array.isArray(change.sources)
                  ? change.sources[0]
                  : change.sources;

                return (
                  <article className="intel-history-item" key={change.id}>
                    <div className="intel-history-meta">
                      <span>{formatDate(change.change_date || change.changed_at)}</span>

                      <span className="intel-badge">
                        {label(change.importance)}
                      </span>

                      {change.severity && (
                        <span className="intel-badge">
                          {label(change.severity)}
                        </span>
                      )}

                      {change.data_confidence && (
                        <span className={confidenceClass(change.data_confidence)}>
                          {label(change.data_confidence)}
                        </span>
                      )}
                    </div>

                    <h3>{label(change.field_name)}</h3>

                    {change.summary && (
                      <p>{change.summary}</p>
                    )}

                    <div className="intel-change-values">
                      <div>
                        <span>Previous</span>
                        <strong>{change.old_value ?? "Unknown"}</strong>
                      </div>

                      <div>
                        <span>New</span>
                        <strong>{change.new_value ?? "Unknown"}</strong>
                      </div>
                    </div>

                    {change.assessment && (
                      <div className="intel-assessment">
                        <strong>Analyst assessment</strong>
                        <p>{change.assessment}</p>
                      </div>
                    )}

                    {changeSource && (
                      <div className="intel-history-source">
                        Source:{" "}
                        <Link href={`/sources/${changeSource.id}`}>
                          {changeSource.title}
                        </Link>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="intel-panel">
        <div className="intel-panel-header">
          <div>
            <div className="intel-panel-kicker">History</div>
            <h2 className="intel-panel-title">Entity history</h2>
          </div>
        </div>

        <div className="intel-panel-body">
          <EntityHistory
            entityType="contract"
            entityId={contract.id}
          />
        </div>
      </section>

      <section className="intel-panel">
        <div className="intel-panel-header">
          <div>
            <div className="intel-panel-kicker">Methodology</div>
            <h2 className="intel-panel-title">How to interpret this record</h2>
          </div>
        </div>

        <div className="intel-panel-body">
          <p className="intel-methodology">
            Contract information is compiled from public-source records and
            structured relationships in the defence intelligence database.
            Values, dates and quantities may be incomplete, estimated or
            subsequently revised. Source-backed information should be
            distinguished from database-derived relationships and analyst
            assessment.
          </p>
        </div>
      </section>
    </main>
  );
}