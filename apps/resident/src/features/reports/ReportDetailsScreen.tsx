import { Link, useNavigate, useParams } from 'react-router';
import { MessageSquareWarning } from 'lucide-react';
import { useApiQuery } from '@beacon/auth';
import {
  ApiError,
  REPORT_STATUS_LABELS,
  formatIncidentDateTime,
  formatTimestamp,
  hazardLabel,
  type ReportDetail,
} from '@beacon/shared';
import {
  Alert,
  Card,
  DemoBadge,
  EmptyState,
  HazardIcon,
  PageHeader,
  Skeleton,
  StatusBadge,
  buttonClassName,
} from '@beacon/ui';
import { MapPicker } from '../report/location/MapPicker';
import { LoadError } from './LoadError';

export function ReportDetailsScreen() {
  const { referenceNo = '' } = useParams();
  const navigate = useNavigate();
  const query = useApiQuery<ReportDetail>(`/me/reports/${encodeURIComponent(referenceNo)}`);
  const report = query.data;

  if (query.error instanceof ApiError && query.error.status === 404) {
    return (
      <EmptyState
        icon={<MessageSquareWarning size={28} />}
        title="Report not found"
        description="This report does not exist or is not one of your reports."
        action={
          <Link to="/my-reports" className={buttonClassName('primary')}>
            Go to My Reports
          </Link>
        }
      />
    );
  }

  return (
    <div className="bcn-stack">
      <PageHeader
        title={report ? hazardLabel(report) : 'Report'}
        subtitle={referenceNo}
        onBack={() => navigate('/my-reports')}
        actions={report?.is_demo ? <DemoBadge /> : undefined}
      />
      {query.error ? (
        <LoadError title="Could not load this report" error={query.error} onRetry={query.reload} />
      ) : !report ? (
        <Card className="bcn-stack">
          <Skeleton height={24} width="50%" />
          <Skeleton height={80} />
        </Card>
      ) : (
        <ReportDetailBody report={report} />
      )}
    </div>
  );
}

function ReportDetailBody({ report }: { report: ReportDetail }) {
  const latestNote = [...report.timeline].reverse().find((t) => t.by === 'mdrrmo' && t.note);
  const hasPin = report.latitude !== null && report.longitude !== null;

  return (
    <>
      <Card className="r-detail-status">
        <HazardIcon code={report.hazard_type.code} size={48} />
        <div>
          <span className="bcn-muted" style={{ fontSize: 'var(--bcn-text-sm)' }}>
            Current status
          </span>
          <div>
            <StatusBadge status={report.status} />
          </div>
        </div>
      </Card>

      {report.status === 'needs_clarification' && (
        <Alert tone="warning" title="The MDRRMO needs more information">
          {latestNote?.note && <p className="r-quote">“{latestNote.note}”</p>}
          <p>Please contact the Dalaguete MDRRMO and mention reference {report.reference_no}.</p>
        </Alert>
      )}

      <Card title="Status history">
        <ol className="r-timeline">
          {report.timeline.map((entry, index) => (
            <li
              key={`${entry.status}-${entry.changed_at}`}
              className={index === report.timeline.length - 1 ? 'is-current' : undefined}
            >
              <strong>{REPORT_STATUS_LABELS[entry.status]}</strong>
              <span className="bcn-muted">
                {formatTimestamp(entry.changed_at)} · {entry.by === 'you' ? 'You' : 'MDRRMO'}
              </span>
              {entry.note && <p className="r-quote">“{entry.note}”</p>}
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Incident details">
        <dl className="r-review-list">
          <dt>Date and time</dt>
          <dd>{formatIncidentDateTime(report.incident_date, report.incident_time)}</dd>
          <dt>What happened</dt>
          <dd className="r-prewrap">{report.description}</dd>
          <dt>Submitted</dt>
          <dd>{formatTimestamp(report.submitted_at)}</dd>
        </dl>
      </Card>

      <Card title="Location" className="bcn-stack">
        <dl className="r-review-list">
          <dt>Barangay</dt>
          <dd>{report.barangay?.name ?? 'Not given'}</dd>
          <dt>Landmark</dt>
          <dd>{report.landmark ?? 'None'}</dd>
          <dt>Municipality</dt>
          <dd>
            {report.municipality}, {report.province}
          </dd>
          <dt>GPS coordinates</dt>
          <dd>{hasPin ? `${report.latitude}, ${report.longitude}` : 'No map pin'}</dd>
        </dl>
        {hasPin && (
          <MapPicker
            readOnly
            position={{ latitude: Number(report.latitude), longitude: Number(report.longitude) }}
          />
        )}
      </Card>

      <Card title="Photos and videos">
        {report.media.length === 0 ? (
          <p className="bcn-muted" style={{ margin: 0 }}>
            No photos or videos were added.
          </p>
        ) : (
          <ul className="r-evidence-grid">
            {report.media.map((media, index) => (
              <li key={media.id} className="r-evidence-item">
                {media.kind === 'photo' ? (
                  <a href={media.url} target="_blank" rel="noreferrer">
                    <img src={media.url} alt={`Photo ${index + 1} for ${report.reference_no}`} />
                  </a>
                ) : (
                  <video
                    src={media.url}
                    controls
                    preload="metadata"
                    aria-label={`Video ${index + 1}`}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
