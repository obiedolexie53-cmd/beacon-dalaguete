import { Link } from 'react-router';
import { Info, Megaphone } from 'lucide-react';
import { Alert, DemoBadge } from '@beacon/ui';
import { DEMO_REPORT, DEMO_RESIDENT } from '../../demo/demoData';
import { ReportSummaryCard } from './ReportSummaryCard';

export function HomeScreen() {
  return (
    <div className="bcn-stack">
      <div>
        <p className="bcn-muted" style={{ margin: 0 }}>
          Good day,
        </p>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {DEMO_RESIDENT.firstName} <DemoBadge />
        </h1>
      </div>

      <Link to="/report" className="r-report-cta">
        <span className="r-report-cta__icon">
          <Megaphone size={28} aria-hidden="true" />
        </span>
        <span>
          <span className="r-report-cta__title">Report a Disaster</span>
          <span className="r-report-cta__text">
            Send an incident report to the Dalaguete MDRRMO
          </span>
        </span>
      </Link>

      <Alert tone="warning" title="In immediate danger?">
        BEACON is not an emergency hotline. If lives are at risk, call <strong>911</strong> or your
        barangay emergency responders first.
      </Alert>

      <section aria-labelledby="recent-heading">
        <div className="r-section-title">
          <h2 id="recent-heading">Recent reports</h2>
          <Link to="/my-reports">View all</Link>
        </div>
        <ReportSummaryCard report={DEMO_REPORT} demo />
      </section>

      <p className="bcn-muted" style={{ fontSize: 'var(--bcn-text-sm)', display: 'flex', gap: 6 }}>
        <Info size={16} aria-hidden="true" style={{ marginTop: 3 }} />
        Sample content shown for design review. Your own reports will appear here.
      </p>
    </div>
  );
}
