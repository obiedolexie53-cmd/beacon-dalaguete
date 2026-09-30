import { Card, DemoBadge, HazardIcon, StatusBadge } from '@beacon/ui';
import type { DemoReportSummary } from '../../demo/demoData';

export function ReportSummaryCard({
  report,
  demo = false,
}: {
  report: DemoReportSummary;
  demo?: boolean;
}) {
  return (
    <Card as="article" className="r-report-card" aria-label={`Report ${report.referenceNo}`}>
      <HazardIcon code={report.hazardCode} size={44} />
      <div className="r-report-card__body">
        <div className="r-report-card__title">
          {report.hazardName}
          {demo && <DemoBadge />}
        </div>
        <div className="r-report-card__meta">
          {report.referenceNo} · Brgy. {report.barangay}
          <br />
          {report.incidentDate}, {report.incidentTime}
        </div>
        <StatusBadge status={report.status} />
      </div>
    </Card>
  );
}
