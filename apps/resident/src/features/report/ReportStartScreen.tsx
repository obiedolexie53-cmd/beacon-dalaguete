import { Alert, Button, Card, PageHeader } from '@beacon/ui';

export const REPORT_STEPS = [
  'Select hazard type',
  'Enter incident details',
  'Provide the incident location',
  'Add photo/video evidence',
  'Review all information',
  'Submit the report',
] as const;

/** Entry to the reporting wizard. The wizard itself is built in Phases 5–8. */
export function ReportStartScreen() {
  return (
    <div className="bcn-stack">
      <PageHeader
        title="Report a Disaster"
        subtitle="Six simple steps. You can review everything before sending."
      />
      <Card>
        <ol className="r-steps">
          {REPORT_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Card>
      <Alert tone="warning" title="Stay safe">
        Do not put yourself in danger to obtain evidence.
      </Alert>
      <Button block disabled>
        Start report (available in Phase 5)
      </Button>
    </div>
  );
}
