import Link from "next/link";

type Evidence = {
  id: number;
  source_id: number | null;
  evidence_type: string;
  evidence_title: string | null;
  evidence_url: string | null;
  evidence_excerpt: string | null;
  evidence_date: string | null;
  publisher: string | null;
  confidence: string | null;
  corroboration_status: string | null;
  analyst_notes: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function EvidencePanel({
  evidence,
}: {
  evidence: Evidence[];
}) {
  return (
    <section className="intel-panel">
      <div className="intel-panel-kicker">
        EVIDENCE
      </div>

      <div className="intel-section-heading">
        <div>
          <h2>Supporting evidence</h2>

          <p className="intel-muted">
            Evidence attached to this intelligence assessment.
          </p>
        </div>

        <span className="intel-badge">
          {evidence.length} source
          {evidence.length === 1 ? "" : "s"}
        </span>
      </div>

      {evidence.length === 0 ? (
        <div className="intel-empty-state">
          <h3>No evidence attached</h3>

          <p>
            This change currently has no separately recorded evidence.
          </p>
        </div>
      ) : (
        <div className="intel-evidence-list">
          {evidence.map((item) => (
            <article
              key={item.id}
              className="intel-evidence-item"
            >
              <div className="intel-feed-meta">
                <span>{item.evidence_type}</span>

                <span>
                  {item.confidence || "confidence not rated"}
                </span>

                <span>
                  {item.corroboration_status ||
                    "single_source"}
                </span>
              </div>

              <h3>
                {item.evidence_title ||
                  item.publisher ||
                  "Evidence"}
              </h3>

              {item.evidence_excerpt && (
                <p>{item.evidence_excerpt}</p>
              )}

              <div className="intel-feed-source">
                <span>
                  {formatDate(item.evidence_date)}
                </span>

                {item.source_id && (
                  <Link href={`/sources/${item.source_id}`}>
                    View source record
                  </Link>
                )}

                {item.evidence_url && (
                  <a
                    href={item.evidence_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open evidence →
                  </a>
                )}
              </div>

              {item.analyst_notes && (
                <div className="intel-assessment">
                  <strong>Analyst note</strong>
                  <p>{item.analyst_notes}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}