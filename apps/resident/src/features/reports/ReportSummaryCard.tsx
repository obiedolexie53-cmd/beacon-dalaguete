import { formatIncidentDateTime, hazardLabel, type ReportSummary } from '@beacon/shared';
import { Card, DemoBadge, HazardIcon, StatusBadge } from '@beacon/ui';

export function ReportSummaryCard({ report }: { report: ReportSummary }) {
  return (
    <Card as="article" className="r-report-card" aria-label={`Report ${report.reference_no}`}>
      <HazardIcon code={report.hazard_type.code} size={44} />
      <div className="r-report-card__body">
        <div className="r-report-card__title">
          {hazardLabel(report)}
          {report.is_demo && <DemoBadge />}
        </div>
        <div className="r-report-card__meta">
          {report.reference_no}
          {report.barangay && ` · Brgy. ${report.barangay.name}`}
          <br />
          {formatIncidentDateTime(report.incident_date, report.incident_time)}
        </div>
        <StatusBadge status={report.status} />
      </div>
    </Card>
  );
}

export function ReportSummaryCardSkeleton() {
  return (
    <div className="bcn-card r-report-card" aria-hidden="true">
      <span className="bcn-skeleton" style={{ width: 44, height: 44, borderRadius: 12 }} />
      <div className="r-report-card__body bcn-stack" style={{ gap: 8 }}>
        <span className="bcn-skeleton" style={{ width: '45%', height: 18 }} />
        <span className="bcn-skeleton" style={{ width: '80%', height: 14 }} />
        <span className="bcn-skeleton" style={{ width: '35%', height: 22 }} />
      </div>
    </div>
  );
}
