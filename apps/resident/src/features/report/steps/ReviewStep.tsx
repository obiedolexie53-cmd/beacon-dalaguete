import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Send } from 'lucide-react';
import {
  ApiError,
  MUNICIPALITY,
  NETWORK_ERROR_MESSAGE,
  OTHER_HAZARD_CODE,
  PROVINCE,
  formatIncidentDateTime,
} from '@beacon/shared';
import { Alert, Button, Card, CheckboxField, HazardIcon } from '@beacon/ui';
import { useReportDraft } from '../draft/ReportDraftProvider';
import type { ReportDraft } from '../draft/draft';
import { listEvidence, type StoredEvidence } from '../evidence/evidenceStore';
import { FIELD_STEPS } from '../submit/buildReport';
import { useSubmitReport, type SubmitState } from '../submit/useSubmitReport';

/** Step 5: review everything, confirm and submit (step 6 happens here). */
export function ReviewStep() {
  const navigate = useNavigate();
  const { draft } = useReportDraft();
  const { state, submit } = useSubmitReport();
  const [confirmed, setConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState<string>();
  const [evidence, setEvidence] = useState<StoredEvidence[] | null>(null);

  const draftId = draft?.clientRequestId;
  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    listEvidence(draftId).then((items) => !cancelled && setEvidence(items));
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  if (!draft) return null;
  const busy = state.phase === 'sending' || state.phase === 'uploading';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!confirmed) {
      setConfirmError('Please confirm that the information is true');
      return;
    }
    const result = await submit(draft!);
    if (result) {
      // The confirmation screen clears the finished draft once it has mounted. Clearing it
      // here would let the wizard (still mounted during the route transition) redirect away.
      navigate(`/report/submitted/${result.report.reference_no}`, {
        replace: true,
        state: {
          rejected: result.rejected,
          completedDraftId: result.pending === 0 ? draft!.clientRequestId : undefined,
        },
      });
    }
  }

  const photos = evidence?.filter((e) => e.kind === 'photo').length ?? 0;
  const videos = evidence?.filter((e) => e.kind === 'video').length ?? 0;

  return (
    <form className="bcn-stack" onSubmit={handleSubmit} noValidate>
      <header className="bcn-page-header">
        <div className="bcn-page-header__text">
          <h1 className="bcn-page-header__title" tabIndex={-1}>
            Review your report
          </h1>
          <p className="bcn-page-header__subtitle">
            Check the details before sending. You can edit any section.
          </p>
        </div>
      </header>

      <SubmitError state={state} />

      <ReviewSection title="Hazard" editTo="/report/new/hazard" disabled={busy}>
        <div className="r-review-hazard">
          {draft.hazardCode && <HazardIcon code={draft.hazardCode} size={40} />}
          <strong>
            {draft.hazardCode === OTHER_HAZARD_CODE
              ? `Other: ${draft.otherHazardText}`
              : draft.hazardName}
          </strong>
        </div>
      </ReviewSection>

      <ReviewSection title="Incident details" editTo="/report/new/details" disabled={busy}>
        <dl className="r-review-list">
          <dt>Date and time</dt>
          <dd>{formatIncidentDateTime(draft.incidentDate, draft.incidentTime || null)}</dd>
          <dt>What happened</dt>
          <dd className="r-prewrap">{draft.description.trim()}</dd>
        </dl>
      </ReviewSection>

      <ReviewSection title="Location" editTo="/report/new/location" disabled={busy}>
        <LocationSummary draft={draft} />
      </ReviewSection>

      <ReviewSection title="Photos and videos" editTo="/report/new/evidence" disabled={busy}>
        {evidence === null ? (
          <p className="bcn-muted">Loading…</p>
        ) : evidence.length === 0 ? (
          <p className="bcn-muted" style={{ margin: 0 }}>
            No photos or videos added.
          </p>
        ) : (
          <p style={{ margin: 0 }}>
            {[
              photos && `${photos} ${photos === 1 ? 'photo' : 'photos'}`,
              videos && `${videos} ${videos === 1 ? 'video' : 'videos'}`,
            ]
              .filter(Boolean)
              .join(' and ')}{' '}
            will be uploaded after the report is sent.
          </p>
        )}
      </ReviewSection>

      <CheckboxField
        label="The information in this report is true to the best of my knowledge."
        checked={confirmed}
        disabled={busy}
        onChange={(e) => {
          setConfirmed(e.target.checked);
          setConfirmError(undefined);
        }}
        error={confirmError}
      />

      {busy ? (
        <SubmitProgress state={state} />
      ) : (
        <div className="r-step-actions">
          <Button variant="secondary" onClick={() => navigate('/report/new/evidence')}>
            Back
          </Button>
          <Button type="submit" variant="accent" icon={<Send size={20} aria-hidden="true" />}>
            Submit report
          </Button>
        </div>
      )}
    </form>
  );
}

function ReviewSection({
  title,
  editTo,
  disabled,
  children,
}: {
  title: string;
  editTo: string;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <Card className="bcn-stack" style={{ gap: 'var(--bcn-space-3)' }}>
      <div className="r-section-title" style={{ margin: 0 }}>
        <h2 className="r-card-heading">{title}</h2>
        {!disabled && (
          <Link to={editTo} aria-label={`Edit ${title.toLowerCase()}`}>
            Edit
          </Link>
        )}
      </div>
      {children}
    </Card>
  );
}

function LocationSummary({ draft }: { draft: ReportDraft }) {
  const hasPin = draft.latitude !== null && draft.longitude !== null;
  return (
    <dl className="r-review-list">
      <dt>Barangay</dt>
      <dd>{draft.barangayName ?? 'Not selected'}</dd>
      <dt>Landmark</dt>
      <dd>{draft.landmark.trim() || 'None'}</dd>
      <dt>Municipality</dt>
      <dd>
        {MUNICIPALITY}, {PROVINCE}
      </dd>
      <dt>GPS coordinates</dt>
      <dd>
        {hasPin
          ? `${draft.latitude!.toFixed(6)}, ${draft.longitude!.toFixed(6)} (${
              draft.locationSource === 'gps' ? 'from your phone' : 'placed on the map'
            })`
          : 'No map pin'}
      </dd>
    </dl>
  );
}

function SubmitProgress({ state }: { state: SubmitState }) {
  const label =
    state.phase === 'uploading'
      ? `Uploading file ${state.current} of ${state.total}…`
      : 'Sending your report…';
  const value = state.phase === 'uploading' ? state.current : 0;
  const max = state.phase === 'uploading' ? state.total : 1;
  return (
    <div className="r-submit-progress" role="status" aria-live="polite">
      <strong>{label}</strong>
      <progress value={value} max={max} aria-label={label} />
      <span className="bcn-muted">Please keep this screen open.</span>
    </div>
  );
}

/** "Report Not Submitted" with the reason and, for field problems, links back to the step. */
function SubmitError({ state }: { state: SubmitState }) {
  if (state.phase !== 'failed') return null;
  const { error } = state;
  if (error instanceof ApiError && error.code === 'validation_error') {
    const steps = new Map<string, { path: string; label: string; messages: string[] }>();
    for (const [field, message] of Object.entries(error.fields)) {
      const step = FIELD_STEPS[field] ?? FIELD_STEPS.request!;
      const entry = steps.get(step.path) ?? { ...step, messages: [] };
      entry.messages.push(message);
      steps.set(step.path, entry);
    }
    return (
      <Alert tone="danger" title="Report Not Submitted">
        <p>Some information needs to be corrected:</p>
        <ul className="r-error-list">
          {[...steps.values()].map((step) => (
            <li key={step.path}>
              {step.messages.join(' ')} <Link to={step.path}>Edit {step.label.toLowerCase()}</Link>
            </li>
          ))}
        </ul>
      </Alert>
    );
  }
  const message =
    error instanceof ApiError && !error.isNetworkError && error.status < 500
      ? error.message
      : NETWORK_ERROR_MESSAGE;
  return (
    <Alert tone="danger" title="Report Not Submitted">
      {message} Your report is still saved on this device.
    </Alert>
  );
}
