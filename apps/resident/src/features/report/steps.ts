export interface WizardStep {
  path: string;
  title: string;
}

/** The six reporting steps, in order. */
export const REPORT_STEPS: readonly WizardStep[] = [
  { path: '/report/new/hazard', title: 'Select hazard type' },
  { path: '/report/new/details', title: 'Incident details' },
  { path: '/report/new/location', title: 'Incident location' },
  { path: '/report/new/evidence', title: 'Photo/video evidence' },
  { path: '/report/new/review', title: 'Review report' },
  { path: '/report/new/submit', title: 'Submit report' },
];

export function stepIndex(pathname: string): number {
  return REPORT_STEPS.findIndex((step) => step.path === pathname);
}
