import { Link } from 'react-router';
import { ClipboardList, Megaphone } from 'lucide-react';
import { useApiQuery, useAuth } from '@beacon/auth';
import type { ResidentDashboard } from '@beacon/shared';
import { Alert, Card, DemoBadge, EmptyState } from '@beacon/ui';
import { LoadError } from '../reports/LoadError';
import { ReportSummaryCard, ReportSummaryCardSkeleton } from '../reports/ReportSummaryCard';
import { StatusSummary } from './StatusSummary';

export function HomeScreen() {
  const { user } = useAuth();
  const dashboard = useApiQuery<ResidentDashboard>('/me/dashboard');
  const firstName = user?.full_name.split(' ')[0] ?? '';
  const data = dashboard.data;
  const needsClarification = data?.counts.needs_clarification ?? 0;
  const hasDemo = data?.recent_reports.some((r) => r.is_demo) ?? false;

  return (
    <div className="bcn-stack">
      <div>
        <p className="bcn-muted" style={{ margin: 0 }}>
          Good day,
        </p>
        <h1 className="r-greeting">
          {firstName} {user?.is_demo && <DemoBadge />}
        </h1>
        {user?.barangay && (
          <p className="bcn-muted" style={{ margin: 0 }}>
            Brgy. {user.barangay.name}, Dalaguete, Cebu
          </p>
        )}
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

      {needsClarification > 0 && (
        <Alert
          tone="warning"
          title={`${needsClarification} ${needsClarification === 1 ? 'report needs' : 'reports need'} clarification`}
          action={<Link to="/my-reports">Open My Reports</Link>}
        >
          The MDRRMO needs more information before verifying.
        </Alert>
      )}

      <Alert tone="warning" title="In immediate danger?">
        BEACON is not an emergency hotline. If lives are at risk, call <strong>911</strong> or your
        barangay emergency responders first.
      </Alert>

      {dashboard.error ? (
        <LoadError
          title="Could not load your reports"
          error={dashboard.error}
          onRetry={dashboard.reload}
        />
      ) : (
        <>
          <section aria-labelledby="summary-heading">
            <div className="r-section-title">
              <h2 id="summary-heading">My reports at a glance</h2>
            </div>
            <Card>
              <StatusSummary counts={data?.counts ?? null} />
            </Card>
          </section>

          <section aria-labelledby="recent-heading" className="bcn-stack" style={{ gap: 12 }}>
            <div className="r-section-title" style={{ margin: 0 }}>
              <h2 id="recent-heading">Recent reports</h2>
              {data && data.counts.total > 0 && <Link to="/my-reports">View all</Link>}
            </div>
            {!data && <ReportSummaryCardSkeleton />}
            {data?.recent_reports.map((report) => (
              <ReportSummaryCard key={report.id} report={report} />
            ))}
            {data && data.recent_reports.length === 0 && (
              <Card>
                <EmptyState
                  icon={<ClipboardList size={28} />}
                  title="No reports yet"
                  description="When you report an incident, you can follow its status here."
                />
              </Card>
            )}
            {hasDemo && (
              <p className="bcn-muted" style={{ fontSize: 'var(--bcn-text-sm)', margin: 0 }}>
                Reports marked DEMO DATA are fictional samples for evaluation, not real incidents.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
