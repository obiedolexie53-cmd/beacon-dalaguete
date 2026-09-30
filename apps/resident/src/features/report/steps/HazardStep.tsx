import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Check } from 'lucide-react';
import { useApiQuery } from '@beacon/auth';
import {
  OTHER_HAZARD_CODE,
  OTHER_HAZARD_MAX,
  validateHazardStep,
  type HazardType,
} from '@beacon/shared';
import { HazardIcon, PageHeader, TextField, cx } from '@beacon/ui';
import { LoadError } from '../../reports/LoadError';
import { useReportDraft } from '../draft/ReportDraftProvider';
import { ErrorSummary } from '../ErrorSummary';
import { StepActions } from '../StepActions';

export function HazardStep() {
  const navigate = useNavigate();
  const { draft, updateDraft } = useReportDraft();
  const hazards = useApiQuery<HazardType[]>('/hazard-types');
  const [errors, setErrors] = useState<ReturnType<typeof validateHazardStep>>({});
  if (!draft) return null;

  function choose(hazard: HazardType) {
    updateDraft({ hazardTypeId: hazard.id, hazardCode: hazard.code, hazardName: hazard.name });
    setErrors({});
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateHazardStep(draft!);
    setErrors(found);
    if (Object.keys(found).length === 0) navigate('/report/new/details');
  }

  return (
    <form className="bcn-stack" onSubmit={handleSubmit} noValidate>
      <PageHeader
        title="What type of hazard?"
        subtitle="Choose the one that best describes the incident."
      />
      <ErrorSummary errors={errors} />

      {hazards.error ? (
        <LoadError
          title="Could not load hazard types"
          error={hazards.error}
          onRetry={hazards.reload}
        />
      ) : (
        <fieldset className="r-hazard-grid" aria-busy={!hazards.data}>
          <legend className="bcn-visually-hidden">Hazard type</legend>
          {!hazards.data &&
            Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="bcn-skeleton r-hazard-option--skeleton" />
            ))}
          {hazards.data?.map((hazard) => {
            const selected = draft.hazardTypeId === hazard.id;
            return (
              <label key={hazard.id} className={cx('r-hazard-option', selected && 'is-selected')}>
                <input
                  type="radio"
                  name="hazard"
                  value={hazard.code}
                  checked={selected}
                  onChange={() => choose(hazard)}
                  aria-invalid={errors.hazard ? true : undefined}
                />
                <HazardIcon code={hazard.code} size={48} />
                <span className="r-hazard-option__name">{hazard.name}</span>
                {selected && (
                  <Check className="r-hazard-option__check" size={20} aria-hidden="true" />
                )}
              </label>
            );
          })}
        </fieldset>
      )}

      {draft.hazardCode === OTHER_HAZARD_CODE && (
        <TextField
          label="Describe the hazard"
          hint="For example: sinkhole, tree fell on power lines, chemical spill"
          required
          maxLength={OTHER_HAZARD_MAX}
          value={draft.otherHazardText}
          onChange={(e) => updateDraft({ otherHazardText: e.target.value })}
          error={errors.otherHazardText}
        />
      )}

      <StepActions onBack={() => navigate('/report')} />
    </form>
  );
}
