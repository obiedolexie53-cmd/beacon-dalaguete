import { useNavigate } from 'react-router';
import { Construction } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader } from '@beacon/ui';

/** Placeholder for steps built in later phases (location: 6, evidence: 7, review/submit: 8). */
export function UpcomingStep({
  title,
  phase,
  backTo,
}: {
  title: string;
  phase: string;
  backTo: string;
}) {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <EmptyState
          icon={<Construction size={28} />}
          title={`Coming in ${phase}`}
          description="This step is still being built. Your draft is saved on this device, so you can continue it later from the Report tab."
        />
      </Card>
      <div className="r-step-actions">
        <Button variant="secondary" onClick={() => navigate(backTo)}>
          Back
        </Button>
      </div>
    </>
  );
}
