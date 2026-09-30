import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@beacon/ui';

export function StepActions({
  onBack,
  nextLabel = 'Next',
  nextDisabled,
}: {
  onBack?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="r-step-actions">
      {onBack && (
        <Button
          variant="secondary"
          onClick={onBack}
          icon={<ArrowLeft size={20} aria-hidden="true" />}
        >
          Back
        </Button>
      )}
      <Button type="submit" disabled={nextDisabled}>
        {nextLabel}
        <ArrowRight size={20} aria-hidden="true" />
      </Button>
    </div>
  );
}
