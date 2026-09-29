import Link from "next/link";

type IntelligenceItem = {
  id: number;
  entity_type: string;
  entity_id: number | null;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  change_date: string | null;
  changed_at: string | null;
  change_type: string | null;
  importance: string | null;
  severity: string | null;
  summary: string | null;
  assessment: string | null;
  data_confidence: string | null;
  source_id: number | null;
  source_title: string | null;
  source_publisher: string | null;
};

function entityHref(item: IntelligenceItem) {
  if (!item.entity_id) return null;

  switch (item.entity_type) {
    case "country":
      return `/countries/${item.entity_id}`;

    case "company":
      return `/companies/${item.entity_id}`;

    case "equipment":
      return `/equipment/${item.entity_id}`;

    case "programme":
      return `/programmes/${item.entity_id}`;

    case "contract":
      return `/contracts/${item.entity_id}`;

    default:
      return null;
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function GlobalIntelligenceFeed({
  items,
}: {
  items: IntelligenceItem[];
}) {
  if (items.length === 0) {
    return (
      <section className="intel-panel">
        <div className="intel-panel-kicker">
          GLOBAL INTELLIGENCE
        </div>

        <h2>No intelligence changes found</h2>

        <p className="intel-muted">
          There are currently no intelligence-eligible changes matching
          the selected filters.
        </p>
      </section>
    );
  }

  return (
    <section className="intel-panel">
      <div className="intel-panel-kicker">
        GLOBAL INTELLIGENCE FEED
      </div>

      <div className="intel-feed">
        {items.map((item) => {
          const href = entityHref(item);

          return (
            <article
              key={item.id}
              className="intel-feed-item"
            >
              <div className="intel-feed-meta">
                <span>
                  {formatDate(
                    item.changed_at || item.change_date,
                  )}
                </span>

                <span>{item.entity_type}</span>

                {item.importance && (
                  <span>{item.importance}</span>
                )}

                {item.severity && (
                  <span>{item.severity}</span>
                )}
              </div>

              <h3>
                {href ? (
                  <Link href={href}>
                    {item.entity_type}{" "}
                    {item.entity_id ? `#${item.entity_id}` : ""}
                  </Link>
                ) : (
                  <>
                    {item.entity_type}{" "}
                    {item.entity_id
                      ? `#${item.entity_id}`
                      : ""}
                  </>
                )}
              </h3>

              {item.summary && (
                <p className="intel-feed-summary">
                  {item.summary}
                </p>
              )}

              {item.field_name && (
                <div className="intel-change-values">
                  <span>
                    {item.field_name}
                  </span>

                  <span>
                    {item.old_value || "—"}
                  </span>

                  <strong>
                    {item.new_value || "—"}
                  </strong>
                </div>
              )}

              {item.assessment && (
                <div className="intel-assessment">
                  <strong>Assessment</strong>
                  <p>{item.assessment}</p>
                </div>
              )}

              <div className="intel-feed-source">
                <span>
                  Confidence:{" "}
                  {item.data_confidence || "not rated"}
                </span>

                {item.source_id && (
                  <Link href={`/sources/${item.source_id}`}>
                    {item.source_title ||
                      item.source_publisher ||
                      "Source"}
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}