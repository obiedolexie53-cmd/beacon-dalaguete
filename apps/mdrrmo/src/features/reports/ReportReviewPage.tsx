import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Mail, MessageSquareWarning, Phone, ShieldAlert } from 'lucide-react';
import { useApiClient, useApiQuery } from '@beacon/auth';
import {
  ApiError,
  NETWORK_ERROR_MESSAGE,
  REPORT_STATUS_LABELS,
  formatIncidentDateTime,
  formatPhMobile,
  formatTimestamp,
  hazardLabel,
  type ReportStatus,
  type StaffReportDetail,
} from '@beacon/shared';
import {
  Alert,
  Button,
  Card,
  DemoBadge,
  EmptyState,
  HazardIcon,
  PageHeader,
  Skeleton,
  StatusBadge,
  TextAreaField,
  buttonClassName,
} from '@beacon/ui';
import { ReportLocationMap } from './ReportLocationMap';

/** Button label and guidance for each status an officer can move a report to. */
export const ACTIONS: Record<
  Exclude<ReportStatus, 'submitted'>,
  { label: string; hint?: string; noteRequired?: boolean; variant: 'primary' | 'secondary' }
> = {
  under_verification: {
    label: 'Mark as Under Verification',
    hint: 'Use this when you start checking the report.',
    variant: 'secondary',
  },
  needs_clarification: {
    label: 'Request Clarification',
    hint: 'The reporter sees your note and is asked to contact the MDRRMO.',
    noteRequired: true,
    variant: 'secondary',
  },
  verified: {
    label: 'Verify Report',
    hint: 'Verify only after confirming the incident. Photos and videos are supporting evidence and do not prove a report is genuine on their own.',
    variant: 'primary',
  },
  resolved: {
    label: 'Mark as Resolved',
    hint: 'Use this when the incident has been handled.',
    variant: 'primary',
  },
};

export function ReportReviewPage() {
  const { referenceNo = '' } = useParams();
  const navigate = useNavigate();
  const query = useApiQuery<StaffReportDetail>(`/staff/reports/${encodeURIComponent(referenceNo)}`);
  const report = query.data;

  if (query.error instanceof ApiError && query.error.status === 404) {
    return (
      <EmptyState
        icon={<MessageSquareWarning size={28} />}
        title="Report not found"
        description={`There is no report with reference ${referenceNo}.`}
        action={
          <Link to="/reports" className={buttonClassName('primary')}>
            Back to Reports
          </Link>
        }
      />
    );
  }

  return (
    <div className="bcn-stack">
      <PageHeader
        title={report ? hazardLabel(report) : `Report ${referenceNo}`}
        subtitle={referenceNo}
        onBack={() => navigate(-1)}
        actions={report?.is_demo ? <DemoBadge /> : undefined}
      />
      {query.error ? (
        <Alert
          tone="danger"
          title="Could not load this report"
          action={
            <Button variant="secondary" size="sm" onClick={query.reload}>
              Try again
            </Button>
          }
        >
          {query.error instanceof ApiError && !query.error.isNetworkError
            ? query.error.message
            : NETWORK_ERROR_MESSAGE}
        </Alert>
      ) : !report ? (
        <Card className="bcn-stack">
          <Skeleton height={28} width="40%" />
          <Skeleton height={120} />
        </Card>
      ) : (
        <div className="m-review">
          <div className="m-review__side bcn-stack">
            <StatusPanel report={report} onUpdated={query.mutate} onReload={query.reload} />
            <ReporterCard report={report} />
          </div>
          <div className="m-review__main bcn-stack">
            <IncidentCard report={report} />
            <LocationCard report={report} />
            <EvidenceCard report={report} onExpired={query.reload} />
            <HistoryCard report={report} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPanel({
  report,
  onUpdated,
  onReload,
}: {
  report: StaffReportDetail;
  onUpdated: (report: StaffReportDetail) => void;
  onReload: () => void;
}) {
  const api = useApiClient();
  const [action, setAction] = useState<Exclude<ReportStatus, 'submitted'> | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string>();
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<ReportStatus | null>(null);

  const actions = report.allowed_actions.filter(
    (s): s is Exclude<ReportStatus, 'submitted'> => s !== 'submitted',
  );

  function choose(next: Exclude<ReportStatus, 'submitted'>) {
    setAction(next);
    setNote('');
    setNoteError(undefined);
    setError(null);
    setDone(null);
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!action) return;
    if (ACTIONS[action].noteRequired && !note.trim()) {
      setNoteError('Tell the reporter what information is needed');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await api.post<StaffReportDetail>(
        `/staff/reports/${report.reference_no}/status`,
        { status: action, from_status: report.status, note: note.trim() || null },
      );
      onUpdated(updated);
      setDone(action);
      setAction(null);
    } catch (err) {
      const apiError =
        err instanceof ApiError ? err : new ApiError(0, 'network_error', NETWORK_ERROR_MESSAGE);
      if (apiError.fields.note) setNoteError(apiError.fields.note);
      else setError(apiError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Status" className="bcn-stack">
      <div>
        <StatusBadge status={report.status} />
      </div>

      {done && (
        <Alert tone="success" title={`Status updated to ${REPORT_STATUS_LABELS[done]}`}>
          The reporter has been notified.
        </Alert>
      )}
      {error && (
        <Alert
          tone="danger"
          title="Status not updated"
          action={
            error.code === 'status_changed' ? (
              <Button variant="secondary" size="sm" onClick={onReload}>
                Reload report
              </Button>
            ) : undefined
          }
        >
          {error.isNetworkError ? NETWORK_ERROR_MESSAGE : error.message}
        </Alert>
      )}

      {actions.length === 0 ? (
        <p className="bcn-muted" style={{ margin: 0 }}>
          This report is resolved. No further status changes are possible.
        </p>
      ) : action ? (
        <form className="bcn-stack" onSubmit={confirm} noValidate>
          <p style={{ margin: 0, fontWeight: 600 }}>{ACTIONS[action].label}</p>
          {ACTIONS[action].hint && (
            <p className="bcn-muted" style={{ margin: 0, fontSize: 'var(--bcn-text-sm)' }}>
              {ACTIONS[action].hint}
            </p>
          )}
          <TextAreaField
            label={ACTIONS[action].noteRequired ? 'Note to the reporter' : 'Note (optional)'}
            hint="The reporter can see this note."
            required={ACTIONS[action].noteRequired}
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setNoteError(undefined);
            }}
            error={noteError}
          />
          <div className="m-actions-row">
            <Button variant="secondary" disabled={saving} onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Confirm
            </Button>
          </div>
        </form>
      ) : (
        <div className="bcn-stack" style={{ gap: 'var(--bcn-space-2)' }}>
          {actions.map((next) => (
            <Button key={next} variant={ACTIONS[next].variant} block onClick={() => choose(next)}>
              {ACTIONS[next].label}
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}

function ReporterCard({ report }: { report: StaffReportDetail }) {
  const { reporter } = report;
  return (
    <Card title="Reporter" className="bcn-stack">
      <dl className="m-detail-list">
        <dt>Name</dt>
        <dd>{reporter.full_name}</dd>
        <dt>Mobile number</dt>
        <dd>
          {reporter.phone ? (
            <a href={`tel:${reporter.phone}`} className="m-contact">
              <Phone size={16} aria-hidden="true" />
              {formatPhMobile(reporter.phone)}
            </a>
          ) : (
            'Not provided'
          )}
        </dd>
        <dt>Email</dt>
        <dd>
          {reporter.email ? (
            <a href={`mailto:${reporter.email}`} className="m-contact">
              <Mail size={16} aria-hidden="true" />
              {reporter.email}
            </a>
          ) : (
            'Not provided'
          )}
        </dd>
        <dt>Home barangay</dt>
        <dd>{reporter.barangay?.name ?? 'Not set'}</dd>
      </dl>
      <p className="m-privacy-note">
        <ShieldAlert size={16} aria-hidden="true" />
        Personal information. Use only to verify and respond to this report (Data Privacy Act of
        2012). Your access is recorded.
      </p>
    </Card>
  );
}

function IncidentCard({ report }: { report: StaffReportDetail }) {
  return (
    <Card title="Incident details">
      <div className="m-incident-head">
        <HazardIcon code={report.hazard_type.code} size={44} />
        <strong>{hazardLabel(report)}</strong>
      </div>
      <dl className="m-detail-list">
        <dt>Date and time of incident</dt>
        <dd>{formatIncidentDateTime(report.incident_date, report.incident_time)}</dd>
        <dt>Submitted</dt>
        <dd>{formatTimestamp(report.submitted_at)}</dd>
        <dt>Description</dt>
        <dd className="m-prewrap">{report.description}</dd>
      </dl>
    </Card>
  );
}

function LocationCard({ report }: { report: StaffReportDetail }) {
  const hasPin = report.latitude !== null && report.longitude !== null;
  return (
    <Card title="Location" className="bcn-stack">
      <dl className="m-detail-list m-detail-list--columns">
        <dt>Barangay</dt>
        <dd>{report.barangay?.name ?? 'Not given'}</dd>
        <dt>Landmark</dt>
        <dd>{report.landmark ?? 'None'}</dd>
        <dt>Municipality</dt>
        <dd>
          {report.municipality}, {report.province}
        </dd>
        <dt>GPS coordinates</dt>
        <dd>
          {hasPin ? (
            <>
              {report.latitude}, {report.longitude}
              <span className="m-cell-note">
                {report.location_source === 'gps'
                  ? `From the reporter's phone${report.location_accuracy_m ? `, accurate to about ${report.location_accuracy_m} m` : ''}`
                  : 'Placed on the map by the reporter'}
              </span>
            </>
          ) : (
            'No map pin. Use the landmark to locate the incident.'
          )}
        </dd>
      </dl>
      {hasPin && (
        <ReportLocationMap
          latitude={Number(report.latitude)}
          longitude={Number(report.longitude)}
          accuracy={report.location_source === 'gps' ? report.location_accuracy_m : null}
        />
      )}
    </Card>
  );
}

function EvidenceCard({ report, onExpired }: { report: StaffReportDetail; onExpired: () => void }) {
  const [expired, setExpired] = useState(false);
  return (
    <Card title="Photos and videos" className="bcn-stack">
      {report.media.length === 0 ? (
        <p className="bcn-muted" style={{ margin: 0 }}>
          No photos or videos were attached.
        </p>
      ) : (
        <>
          <p className="bcn-muted" style={{ margin: 0, fontSize: 'var(--bcn-text-sm)' }}>
            Supporting evidence only: it does not prove on its own that the incident is genuine.
          </p>
          {expired && (
            <Alert
              tone="info"
              title="Viewing links expired"
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setExpired(false);
                    onExpired();
                  }}
                >
                  Reload evidence
                </Button>
              }
            >
              For privacy, evidence links expire after a few minutes.
            </Alert>
          )}
          <ul className="m-evidence">
            {report.media.map((media, index) =>
              media.kind === 'photo' ? (
                <li key={media.id}>
                  <a href={media.url} target="_blank" rel="noreferrer">
                    <img
                      src={media.url}
                      alt={`Photo ${index + 1} for ${report.reference_no}`}
                      onError={() => setExpired(true)}
                    />
                  </a>
                </li>
              ) : (
                <li key={media.id}>
                  <video
                    src={media.url}
                    controls
                    preload="metadata"
                    aria-label={`Video ${index + 1} for ${report.reference_no}`}
                    onError={() => setExpired(true)}
                  />
                </li>
              ),
            )}
          </ul>
        </>
      )}
    </Card>
  );
}

function HistoryCard({ report }: { report: StaffReportDetail }) {
  return (
    <Card title="Status history">
      <ol className="m-timeline">
        {report.timeline.map((entry, index) => (
          <li
            key={`${entry.status}-${entry.changed_at}`}
            className={index === report.timeline.length - 1 ? 'is-current' : undefined}
          >
            <strong>{REPORT_STATUS_LABELS[entry.status]}</strong>
            <span className="bcn-muted">
              {formatTimestamp(entry.changed_at)} ·{' '}
              {entry.by_role === 'resident'
                ? `${entry.actor_name ?? 'Reporter'} (reporter)`
                : `${entry.actor_name ?? 'MDRRMO'}, MDRRMO`}
            </span>
            {entry.note && <p className="m-quote">“{entry.note}”</p>}
          </li>
        ))}
      </ol>
    </Card>
  );
}
