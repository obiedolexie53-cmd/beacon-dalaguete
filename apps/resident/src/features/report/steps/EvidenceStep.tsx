import { useRef, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Camera, Images, Trash2, RefreshCw, Video, Clapperboard } from 'lucide-react';
import { MAX_VIDEO_BYTES, formatBytes, type EvidenceKind } from '@beacon/shared';
import { Alert, Button, Card, Skeleton, Spinner } from '@beacon/ui';
import { useReportDraft } from '../draft/ReportDraftProvider';
import { StepActions } from '../StepActions';
import { EVIDENCE_LIMITS, useEvidence, type EvidenceItem } from '../evidence/useEvidence';

const LABELS: Record<EvidenceKind, { title: string; singular: string }> = {
  photo: { title: 'Photos', singular: 'photo' },
  video: { title: 'Videos', singular: 'video' },
};

/** Step 4: optional photo/video evidence, kept on the device until the report is sent. */
export function EvidenceStep() {
  const navigate = useNavigate();
  const { draft } = useReportDraft();
  if (!draft) return null;
  return (
    <EvidenceForm
      draftId={draft.clientRequestId}
      onBack={() => navigate('/report/new/location')}
      onNext={() => navigate('/report/new/review')}
    />
  );
}

function EvidenceForm({
  draftId,
  onBack,
  onNext,
}: {
  draftId: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const evidence = useEvidence(draftId);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onNext();
  }

  return (
    <form className="bcn-stack" onSubmit={handleSubmit} noValidate>
      <header className="bcn-page-header">
        <div className="bcn-page-header__text">
          <h1 className="bcn-page-header__title" tabIndex={-1}>
            Add photos or videos
          </h1>
          <p className="bcn-page-header__subtitle">
            Optional. Evidence helps MDRRMO personnel understand the situation.
          </p>
        </div>
      </header>

      <Alert tone="warning" title="Stay safe">
        Do not put yourself in danger to obtain evidence.
      </Alert>

      {evidence.problems.length > 0 && (
        <Alert tone="danger" title="Some files were not added">
          <ul className="r-error-list">
            {evidence.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </Alert>
      )}

      {(['photo', 'video'] as const).map((kind) => (
        <EvidenceSection
          key={kind}
          kind={kind}
          items={evidence.items?.filter((item) => item.kind === kind) ?? null}
          busy={evidence.busy}
          onAdd={(files) => evidence.add(files, kind)}
          onRemove={evidence.remove}
          onReplace={evidence.replace}
        />
      ))}

      <p className="bcn-muted" style={{ margin: 0, fontSize: 'var(--bcn-text-sm)' }}>
        Photos and videos are supporting evidence. MDRRMO personnel still review and verify every
        report. Location details hidden inside photos are removed before they are stored.
      </p>

      <StepActions onBack={onBack} nextDisabled={evidence.busy} />
    </form>
  );
}

function EvidenceSection({
  kind,
  items,
  busy,
  onAdd,
  onRemove,
  onReplace,
}: {
  kind: EvidenceKind;
  items: EvidenceItem[] | null;
  busy: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onReplace: (id: string, file: File) => void;
}) {
  const captureRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replacing = useRef<string | null>(null);
  const { title, singular } = LABELS[kind];
  const limit = EVIDENCE_LIMITS[kind];
  const count = items?.length ?? 0;
  const full = count >= limit;
  const accept = kind === 'photo' ? 'image/*' : 'video/*';

  function picked(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ''; // allow picking the same file again
    if (files.length) onAdd(files);
  }

  function pickedReplacement(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file && replacing.current) onReplace(replacing.current, file);
    replacing.current = null;
  }

  return (
    <Card className="bcn-stack" aria-labelledby={`${kind}-heading`}>
      <div className="r-section-title" style={{ margin: 0 }}>
        <h2 id={`${kind}-heading`} className="r-card-heading">
          {title}
        </h2>
        <span className="bcn-muted" style={{ fontSize: 'var(--bcn-text-sm)' }}>
          {count} of {limit}
        </span>
      </div>

      {kind === 'video' && (
        <p className="bcn-muted" style={{ margin: 0, fontSize: 'var(--bcn-text-sm)' }}>
          Short clips work best. Each video can be up to {formatBytes(MAX_VIDEO_BYTES)}.
        </p>
      )}

      <div className="r-evidence-actions">
        <Button
          variant="secondary"
          disabled={full || busy}
          icon={
            kind === 'photo' ? (
              <Camera size={20} aria-hidden="true" />
            ) : (
              <Video size={20} aria-hidden="true" />
            )
          }
          onClick={() => captureRef.current?.click()}
        >
          {kind === 'photo' ? 'Take photo' : 'Record video'}
        </Button>
        <Button
          variant="secondary"
          disabled={full || busy}
          icon={
            kind === 'photo' ? (
              <Images size={20} aria-hidden="true" />
            ) : (
              <Clapperboard size={20} aria-hidden="true" />
            )
          }
          onClick={() => pickRef.current?.click()}
        >
          {kind === 'photo' ? 'Choose photos' : 'Choose video'}
        </Button>
      </div>
      {/* capture opens the camera directly on phones; the second input opens the gallery. */}
      <input
        ref={captureRef}
        type="file"
        accept={accept}
        capture="environment"
        hidden
        onChange={picked}
        data-testid={`${kind}-capture`}
      />
      <input
        ref={pickRef}
        type="file"
        accept={accept}
        multiple={kind === 'photo'}
        hidden
        onChange={picked}
        data-testid={`${kind}-pick`}
      />
      <input
        ref={replaceRef}
        type="file"
        accept={accept}
        hidden
        onChange={pickedReplacement}
        data-testid={`${kind}-replace`}
      />

      {busy && (
        <p className="r-evidence-busy" role="status">
          <Spinner label="" /> Preparing {singular}…
        </p>
      )}

      {items === null ? (
        <Skeleton height={96} />
      ) : (
        items.length > 0 && (
          <ul className="r-evidence-grid">
            {items.map((item, index) => {
              const name = `${singular} ${index + 1}`;
              return (
                <li key={item.id} className="r-evidence-item">
                  {kind === 'photo' ? (
                    <img src={item.previewUrl} alt={`Preview of ${name}`} />
                  ) : (
                    <video
                      src={item.previewUrl}
                      controls
                      preload="metadata"
                      aria-label={`Preview of ${name}`}
                    />
                  )}
                  <span className="r-evidence-item__size">{formatBytes(item.size)}</span>
                  <div className="r-evidence-item__actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      icon={<RefreshCw size={16} aria-hidden="true" />}
                      aria-label={`Replace ${name}`}
                      onClick={() => {
                        replacing.current = item.id;
                        replaceRef.current?.click();
                      }}
                    >
                      Replace
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      icon={<Trash2 size={16} aria-hidden="true" />}
                      aria-label={`Remove ${name}`}
                      onClick={() => onRemove(item.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}
    </Card>
  );
}
