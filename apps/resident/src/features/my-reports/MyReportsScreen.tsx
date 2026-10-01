import { Link } from 'react-router';
import { ClipboardList } from 'lucide-react';
import { useApiQuery } from '@beacon/auth';
import type { ReportPage } from '@beacon/shared';
import { EmptyState, PageHeader, buttonClassName } from '@beacon/ui';
import { LoadError } from '../reports/LoadError';
import { ReportSummaryCard, ReportSummaryCardSkeleton } from '../reports/ReportSummaryCard';

export function MyReportsScreen() {
  const reports = useApiQuery<ReportPage>('/me/reports?limit=50');
  const page = reports.data;

  return (
    <div className="bcn-stack">
      <PageHeader
        title="My Reports"
        subtitle={
          page && page.total > 0
            ? `${page.total} ${page.total === 1 ? 'report' : 'reports'} · Only you can see these.`
            : 'Only you can see the reports you submit.'
        }
      />

      {reports.error ? (
        <LoadError
          title="Could not load your reports"
          error={reports.error}
          onRetry={reports.reload}
        />
      ) : !page ? (
        <>
          <ReportSummaryCardSkeleton />
          <ReportSummaryCardSkeleton />
        </>
      ) : page.items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={28} />}
          title="No reports yet"
          description="When you submit a disaster report, you can follow its status here."
          action={
            <Link to="/report" className={buttonClassName('primary')}>
              Report a Disaster
            </Link>
          }
        />
      ) : (
        page.items.map((report) => <ReportSummaryCard key={report.id} report={report} />)
      )}
    </div>
  );
}
