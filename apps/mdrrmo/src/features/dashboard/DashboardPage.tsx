import { useEffect, useState } from 'react';
import { Link } from 'react-router';
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
  formatIncidentDateTime,
  formatTimestamp,
  hazardLabel,
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
  HazardIcon,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@beacon/ui';

/** The dashboard refreshes itself while it is on screen. */
export const DASHBOARD_REFRESH_MS = 60_000;

const TILES: Array<{ key: keyof StaffStatusCounts; label: string; Icon: LucideIcon }> = [
  { key: 'total', label: 'Total reports', Icon: FileText },
  { key: 'new', label: 'New reports', Icon: Inbox },
  { key: 'under_verification', label: 'Under verification', Icon: Search },
  { key: 'needs_clarification', label: 'Needs clarification', Icon: CircleHelp },
  { key: 'verified', label: 'Verified', Icon: ShieldCheck },
  { key: 'resolved', label: 'Resolved', Icon: CircleCheckBig },
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
        {TILES.map(({ key, label, Icon }) => (
          <Card key={key} className="m-stat">
            <span className="m-stat__label">
              <Icon size={18} aria-hidden="true" />
              {label}
            </span>
            <span className="m-stat__value">
              {data ? data.counts[key] : <Skeleton width={48} height={32} />}
            </span>
          </Card>
        ))}
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
          <RecentReportsTable data={data} />
        ) : null}
      </Card>
    </div>
  );
}

function RecentReportsTable({ data }: { data: StaffDashboard }) {
  return (
    <div className="m-table-wrap">
      <table className="m-table">
        <caption className="bcn-visually-hidden">
          The {data.recent_reports.length} most recently submitted reports
        </caption>
        <thead>
          <tr>
            <th scope="col">Report ID</th>
            <th scope="col">Hazard</th>
            <th scope="col">Barangay</th>
            <th scope="col" className="m-col-date">
              Date/time
            </th>
            <th scope="col">Status</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {data.recent_reports.map((row) => (
            <tr key={row.id}>
              <td>
                <span className="m-ref-cell">
                  {row.reference_no}
                  {row.is_demo && <DemoBadge>DEMO</DemoBadge>}
                </span>
              </td>
              <td>
                <span className="m-hazard-cell">
                  <HazardIcon code={row.hazard_type.code} size={32} />
                  {hazardLabel(row)}
                </span>
              </td>
              <td>{row.barangay?.name ?? '—'}</td>
              <td className="m-col-date">
                {formatIncidentDateTime(row.incident_date, row.incident_time)}
                <span className="m-cell-note">Submitted {formatTimestamp(row.submitted_at)}</span>
              </td>
              <td>
                <StatusBadge status={row.status} />
              </td>
              <td>
                <Link
                  to={`/reports/${row.reference_no}`}
                  aria-label={`Review report ${row.reference_no}`}
                >
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
