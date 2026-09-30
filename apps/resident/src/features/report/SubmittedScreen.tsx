import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { CircleCheckBig, UploadCloud } from 'lucide-react';
import { Alert, Button, Card, StatusBadge, buttonClassName } from '@beacon/ui';
import { useReportDraft } from './draft/ReportDraftProvider';
import { listEvidence } from './evidence/evidenceStore';
import { useSubmitReport } from './submit/useSubmitReport';

interface SubmittedState {
  rejected?: string[];
  /** Set when every file was sent: this draft is finished and can be removed. */
  completedDraftId?: string;
}

/** "Report Submitted Successfully": reference number, status, and any evidence still to send. */
export function SubmittedScreen() {
  const { referenceNo = '' } = useParams();
  const initial = (useLocation().state as SubmittedState | null) ?? {};
  const { draft, discardDraft } = useReportDraft();
  const { state, submit } = useSubmitReport();
  const [rejected, setRejected] = useState<string[]>(initial.rejected ?? []);
  const [pending, setPending] = useState<number | null>(null);
  const [allUploaded, setAllUploaded] = useState(false);

  // Remove a fully sent draft now that the wizard is no longer on screen.
  const completedDraftId = initial.completedDraftId;
  const draftId = draft?.clientRequestId;
  useEffect(() => {
    if (completedDraftId && draftId === completedDraftId) discardDraft();
  }, [completedDraftId, draftId, discardDraft]);

  // Files still waiting belong to the draft that produced this report.
  const waitingDraft = draft?.submittedReferenceNo === referenceNo ? draft : null;
  const waitingDraftId = waitingDraft?.clientRequestId;
  useEffect(() => {
    let cancelled = false;
    if (!waitingDraftId) return;
    listEvidence(waitingDraftId).then((items) => !cancelled && setPending(items.length));
    return () => {
      cancelled = true;
    };
  }, [waitingDraftId]);
  const waiting = waitingDraft ? (pending ?? 0) : 0;

  async function retry() {
    if (!waitingDraft) return;
    const result = await submit(waitingDraft);
    if (result) {
      setRejected((r) => [...r, ...result.rejected]);
      setPending(result.pending);
      if (result.pending === 0) setAllUploaded(true);
      if (result.pending === 0) discardDraft();
    }
  }

  const uploading = state.phase === 'sending' || state.phase === 'uploading';

  return (
    <div className="bcn-stack">
      <Card className="r-submitted">
        <CircleCheckBig className="r-submitted__icon" size={56} aria-hidden="true" />
        <h1 tabIndex={-1}>Report Submitted Successfully</h1>
        <p className="bcn-muted" style={{ margin: 0 }}>
          Reference number
        </p>
        <p className="r-submitted__ref">{referenceNo}</p>
        <div className="r-submitted__status">
          <span className="bcn-muted">Status:</span> <StatusBadge status="submitted" />
        </div>
      </Card>

      {waiting > 0 && (
        <Alert
          tone="warning"
          title={`${waiting} ${waiting === 1 ? 'file was' : 'files were'} not uploaded`}
          action={
            <div className="r-step-actions">
              <Button
                size="sm"
                loading={uploading}
                icon={<UploadCloud size={18} aria-hidden="true" />}
                onClick={retry}
              >
                Retry upload
              </Button>
              <Button variant="secondary" size="sm" disabled={uploading} onClick={discardDraft}>
                Skip these files
              </Button>
            </div>
          }
        >
          Your report was received, but some photos or videos could not be sent. Please check your
          connection and try again. They are kept on this device until then.
        </Alert>
      )}
      {allUploaded && <Alert tone="success" title="All files uploaded" />}
      {rejected.length > 0 && (
        <Alert tone="danger" title="Some files could not be added">
          <ul className="r-error-list">
            {rejected.map((problem, index) => (
              <li key={index}>{problem}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Card title="What happens next">
        <ol className="r-next-steps">
          <li>Authorized MDRRMO personnel will review and verify your report.</li>
          <li>You will get a notification in BEACON when its status changes.</li>
          <li>Keep your reference number in case you need to follow up with the MDRRMO.</li>
        </ol>
      </Card>

      <Link
        to={`/my-reports/${referenceNo}`}
        className={buttonClassName('primary', { block: true })}
      >
        View report
      </Link>
      <Link to="/home" className={buttonClassName('secondary', { block: true })}>
        Back to Home
      </Link>
    </div>
  );
}
