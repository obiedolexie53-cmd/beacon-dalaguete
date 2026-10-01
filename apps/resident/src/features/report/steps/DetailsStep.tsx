import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  DESCRIPTION_MAX,
  earliestIncidentDate,
  localNow,
  validateDetailsStep,
} from '@beacon/shared';
import { PageHeader, TextAreaField, TextField } from '@beacon/ui';
import { useReportDraft } from '../draft/ReportDraftProvider';
import { ErrorSummary } from '../ErrorSummary';
import { StepActions } from '../StepActions';

export function DetailsStep() {
  const navigate = useNavigate();
  const { draft, updateDraft } = useReportDraft();
  const [errors, setErrors] = useState<ReturnType<typeof validateDetailsStep>>({});
  if (!draft) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateDetailsStep(draft!);
    setErrors(found);
    if (Object.keys(found).length === 0) navigate('/report/new/location');
  }

  const length = draft.description.trim().length;

  return (
    <form className="bcn-stack" onSubmit={handleSubmit} noValidate>
      <PageHeader
        title="Incident details"
        subtitle={
          draft.hazardCode === 'other' && draft.otherHazardText
            ? `Other hazard: ${draft.otherHazardText}`
            : draft.hazardName
        }
      />
      <ErrorSummary errors={errors} />

      <TextAreaField
        label="What happened?"
        hint="Describe what you saw: what is affected, how serious it is, and whether people are hurt or trapped."
        required
        rows={6}
        maxLength={DESCRIPTION_MAX}
        value={draft.description}
        onChange={(e) => updateDraft({ description: e.target.value })}
        error={errors.description}
      />
      <p className="r-char-count" aria-live="polite">
        {length} / {DESCRIPTION_MAX} characters
      </p>

      <div className="r-field-row">
        <TextField
          label="Date of incident"
          type="date"
          required
          min={earliestIncidentDate()}
          max={localNow().date}
          value={draft.incidentDate}
          onChange={(e) => updateDraft({ incidentDate: e.target.value })}
          error={errors.incidentDate}
        />
        <TextField
          label="Time of incident"
          type="time"
          required
          value={draft.incidentTime}
          onChange={(e) => updateDraft({ incidentTime: e.target.value })}
          error={errors.incidentTime}
        />
      </div>
      <p className="r-char-count" style={{ textAlign: 'left' }}>
        An approximate date and time is fine.
      </p>

      <StepActions onBack={() => navigate('/report/new/hazard')} />
    </form>
  );
}
