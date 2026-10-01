/**
 * Report status workflow.
 *
 * Mirrors backend/app/reports/workflow.py; the backend is the source of truth
 * and enforces these rules. The clients use this copy only to decide which
 * actions and labels to show.
 *
 *   submitted ─► under_verification ─► verified ─► resolved
 *       │               │    ▲
 *       └───────────────┴──► needs_clarification
 *
 * A new report always starts as `submitted`. Only authorized MDRRMO personnel
 * move a report forward. Nothing becomes `verified` automatically.
 */
export const REPORT_STATUSES = [
  'submitted',
  'under_verification',
  'needs_clarification',
  'verified',
  'resolved',
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const INITIAL_REPORT_STATUS: ReportStatus = 'submitted';

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  submitted: 'Submitted',
  under_verification: 'Under Verification',
  needs_clarification: 'For Verification / Needs Clarification',
  verified: 'Verified',
  resolved: 'Resolved',
};

export const ALLOWED_STATUS_TRANSITIONS: Record<ReportStatus, readonly ReportStatus[]> = {
  submitted: ['under_verification', 'needs_clarification'],
  under_verification: ['verified', 'needs_clarification'],
  needs_clarification: ['under_verification'],
  verified: ['resolved'],
  resolved: [],
};

export function canTransition(from: ReportStatus, to: ReportStatus): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}
