import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { formatIncidentDateTime, hazardLabel, type ReportSummary } from '@beacon/shared';
import { Card, DemoBadge, HazardIcon, StatusBadge } from '@beacon/ui';

/** Report summary; the whole card opens the report's details. */
export function ReportSummaryCard({ report }: { report: ReportSummary }) {
  return (
    <Card
      as="article"
      className="r-report-card r-report-card--link"
      aria-label={`Report ${report.reference_no}`}
    >
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
      <ChevronRight className="r-report-card__chevron" size={20} aria-hidden="true" />
      {/* Stretched over the card by CSS; its text names the report for screen readers. */}
      <Link to={`/my-reports/${report.reference_no}`} className="r-report-card__link">
        <span className="bcn-visually-hidden">View report {report.reference_no}</span>
      </Link>
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
