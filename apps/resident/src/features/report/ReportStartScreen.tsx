import { useState } from 'react';
import { useNavigate } from 'react-router';
import { FilePen } from 'lucide-react';
import { formatTimestamp } from '@beacon/shared';
import { Alert, Button, Card, HazardIcon, PageHeader } from '@beacon/ui';
import { useReportDraft } from './draft/ReportDraftProvider';
import { REPORT_STEPS } from './steps';

/** Entry to reporting: explains the steps and offers to continue an unsent draft. */
export function ReportStartScreen() {
  const navigate = useNavigate();
  const { draft, startDraft, discardDraft } = useReportDraft();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  function startNew() {
    startDraft();
    navigate('/report/new/hazard');
  }

  function continueDraft() {
    navigate(draft?.hazardCode ? '/report/new/details' : '/report/new/hazard');
  }

  if (draft?.submittedReferenceNo) {
    return (
      <div className="bcn-stack">
        <PageHeader title="Report a Disaster" />
        <Alert
          tone="warning"
          title="Files still waiting to upload"
          action={
            <Button onClick={() => navigate(`/report/submitted/${draft.submittedReferenceNo}`)}>
              Finish uploading
            </Button>
          }
        >
          Report {draft.submittedReferenceNo} was sent, but some photos or videos have not been
          uploaded yet. Finish or skip them before starting a new report.
        </Alert>
      </div>
    );
  }

  return (
    <div className="bcn-stack">
      <PageHeader
        title="Report a Disaster"
        subtitle="Six simple steps. You can review everything before sending."
      />

      {draft && (
        <Card className="bcn-stack" aria-labelledby="draft-heading">
          <div className="r-draft-card">
            {draft.hazardCode ? (
              <HazardIcon code={draft.hazardCode} size={44} />
            ) : (
              <span className="bcn-hazard-icon" style={{ width: 44, height: 44 }}>
                <FilePen size={24} aria-hidden="true" />
              </span>
            )}
            <div>
              <h2 id="draft-heading" style={{ fontSize: 'var(--bcn-text-lg)', margin: 0 }}>
                Unsent draft{draft.hazardName ? `: ${draft.hazardName}` : ''}
              </h2>
              <p className="bcn-muted" style={{ margin: 0, fontSize: 'var(--bcn-text-sm)' }}>
                Last edited {formatTimestamp(draft.updatedAt)}
              </p>
            </div>
          </div>
          <Button block onClick={continueDraft}>
            Continue draft
          </Button>
          {confirmDiscard ? (
            <Alert
              tone="warning"
              title="Discard this draft?"
              action={
                <div className="r-step-actions">
                  <Button variant="secondary" size="sm" onClick={() => setConfirmDiscard(false)}>
                    Keep draft
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      discardDraft();
                      setConfirmDiscard(false);
                    }}
                  >
                    Discard
                  </Button>
                </div>
              }
            >
              The information you entered will be deleted from this device.
            </Alert>
          ) : (
            <Button variant="ghost" block onClick={() => setConfirmDiscard(true)}>
              Discard draft
            </Button>
          )}
        </Card>
      )}

      <Card>
        <ol className="r-steps">
          {REPORT_STEPS.map((step) => (
            <li key={step.path}>{step.title}</li>
          ))}
        </ol>
      </Card>
      <Alert tone="warning" title="Stay safe">
        Do not put yourself in danger to obtain evidence.
      </Alert>
      {!draft && (
        <Button block onClick={startNew}>
          Start report
        </Button>
      )}
    </div>
  );
}
