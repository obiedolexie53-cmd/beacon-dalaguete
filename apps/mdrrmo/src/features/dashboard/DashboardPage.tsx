import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ReportsTable } from '../reports/ReportsTable';
import {
  CircleCheckBig,
  CircleHelp,
  FileText,
  Inbox,
  RefreshCw,
  Search,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useApiQuery } from '@beacon/auth';
import {
  ApiError,
  NETWORK_ERROR_MESSAGE,
  formatTimestamp,
  type StaffDashboard,
  type StaffStatusCounts,
} from '@beacon/shared';
import {
  Alert,
  Button,
  Card,
  CheckboxField,
  DemoBadge,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@beacon/ui';

/** The dashboard refreshes itself while it is on screen. */
export const DASHBOARD_REFRESH_MS = 60_000;

const TILES: Array<{
  key: keyof StaffStatusCounts;
  label: string;
  Icon: LucideIcon;
  status?: string;
}> = [
  { key: 'total', label: 'Total reports', Icon: FileText },
  { key: 'new', label: 'New reports', Icon: Inbox, status: 'submitted' },
  {
    key: 'under_verification',
    label: 'Under verification',
    Icon: Search,
    status: 'under_verification',
  },
  {
    key: 'needs_clarification',
    label: 'Needs clarification',
    Icon: CircleHelp,
    status: 'needs_clarification',
  },
  { key: 'verified', label: 'Verified', Icon: ShieldCheck, status: 'verified' },
  { key: 'resolved', label: 'Resolved', Icon: CircleCheckBig, status: 'resolved' },
];

export function DashboardPage() {
  const [includeDemo, setIncludeDemo] = useState(true);
  const query = useApiQuery<StaffDashboard>(`/staff/dashboard?include_demo=${includeDemo}`);
  const { data, error, loading, reload } = query;

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, DASHBOARD_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  return (
    <div className="bcn-stack">
      <PageHeader
        title="Monitoring Dashboard"
        subtitle="Disaster reports submitted by residents of Dalaguete."
        actions={
          <div className="m-refresh">
            {data && (
              <span className="bcn-muted" aria-live="polite">
                Updated {formatTimestamp(data.generated_at)}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              loading={loading && !!data}
              icon={<RefreshCw size={16} aria-hidden="true" />}
              onClick={reload}
            >
              Refresh
            </Button>
          </div>
        }
      />

      <CheckboxField
        label={
          <>
            Include <DemoBadge /> records in counts and lists
          </>
        }
        checked={includeDemo}
        onChange={(e) => setIncludeDemo(e.target.checked)}
      />

      {error !== null && (
        <Alert
          tone="danger"
          title="Could not load the dashboard"
          action={
            <Button variant="secondary" size="sm" onClick={reload}>
              Try again
            </Button>
          }
        >
          {error instanceof ApiError && !error.isNetworkError
            ? error.message
            : NETWORK_ERROR_MESSAGE}
          {data && ' Showing the last loaded figures.'}
        </Alert>
      )}

      <div className="m-stats" aria-label="Report counts" aria-busy={!data}>
        {TILES.map(({ key, label, Icon, status }) => {
          const params = new URLSearchParams();
          if (status) params.set('status', status);
          if (!includeDemo) params.set('demo', '0');
          const query = params.toString();
          return (
            <Link
              key={key}
              to={query ? `/reports?${query}` : '/reports'}
              className="bcn-card m-stat m-stat--link"
              aria-label={data ? `${label}: ${data.counts[key]}. View these reports` : label}
            >
              <span className="m-stat__label">
                <Icon size={18} aria-hidden="true" />
                {label}
              </span>
              <span className="m-stat__value">
                {data ? data.counts[key] : <Skeleton width={48} height={32} />}
              </span>
            </Link>
          );
        })}
      </div>

      <Card title="Recent reports">
        {!data && !error ? (
          <div className="bcn-stack" style={{ gap: 12 }}>
            <Skeleton height={40} />
            <Skeleton height={40} />
            <Skeleton height={40} />
          </div>
        ) : data && data.recent_reports.length === 0 ? (
          <EmptyState
            icon={<Inbox size={28} />}
            title="No reports available"
            description="New reports from residents will appear here."
          />
        ) : data ? (
          <ReportsTable
            rows={data.recent_reports}
            caption={`The ${data.recent_reports.length} most recently submitted reports`}
          />
        ) : null}
      </Card>
    </div>
  );
}
