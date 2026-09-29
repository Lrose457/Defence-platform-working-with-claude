type Props = {
  evidenceCount?: number | null;
  primaryEvidenceCount?: number | null;
  corroboratedEvidenceCount?: number | null;
  highConfidenceEvidenceCount?: number | null;
};

export default function IntelligenceEvidenceSummary({
  evidenceCount = 0,
  primaryEvidenceCount = 0,
  corroboratedEvidenceCount = 0,
  highConfidenceEvidenceCount = 0,
}: Props) {
  return (
    <div className="intel-evidence-summary">
      <div>
        <span className="intel-metric-label">
          Evidence
        </span>
        <strong>{evidenceCount || 0}</strong>
      </div>

      <div>
        <span className="intel-metric-label">
          Primary
        </span>
        <strong>{primaryEvidenceCount || 0}</strong>
      </div>

      <div>
        <span className="intel-metric-label">
          Corroborated
        </span>
        <strong>
          {corroboratedEvidenceCount || 0}
        </strong>
      </div>

      <div>
        <span className="intel-metric-label">
          High confidence
        </span>
        <strong>
          {highConfidenceEvidenceCount || 0}
        </strong>
      </div>
    </div>
  );
}