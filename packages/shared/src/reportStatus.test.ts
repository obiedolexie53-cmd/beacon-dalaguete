import { describe, expect, it } from 'vitest';
import {
  ALLOWED_STATUS_TRANSITIONS,
  INITIAL_REPORT_STATUS,
  REPORT_STATUSES,
  canTransition,
} from './reportStatus';
import { isReferenceNumber } from './referenceNumber';

describe('report status workflow', () => {
  it('starts new reports as submitted', () => {
    expect(INITIAL_REPORT_STATUS).toBe('submitted');
  });

  it('never lets a submitted report become verified directly', () => {
    expect(canTransition('submitted', 'verified')).toBe(false);
  });

  it('follows the Submitted → Under Verification → Verified → Resolved path', () => {
    expect(canTransition('submitted', 'under_verification')).toBe(true);
    expect(canTransition('under_verification', 'verified')).toBe(true);
    expect(canTransition('verified', 'resolved')).toBe(true);
  });

  it('allows Needs Clarification and returning to verification', () => {
    expect(canTransition('submitted', 'needs_clarification')).toBe(true);
    expect(canTransition('under_verification', 'needs_clarification')).toBe(true);
    expect(canTransition('needs_clarification', 'under_verification')).toBe(true);
  });

  it('treats resolved as final', () => {
    expect(ALLOWED_STATUS_TRANSITIONS.resolved).toEqual([]);
  });

  it('defines transitions for every status', () => {
    expect(Object.keys(ALLOWED_STATUS_TRANSITIONS).sort()).toEqual([...REPORT_STATUSES].sort());
  });
});

describe('reference numbers', () => {
  it('matches the BEA-YYYY-NNNNNN format', () => {
    expect(isReferenceNumber('BEA-2026-000123')).toBe(true);
    expect(isReferenceNumber('BEA-26-123')).toBe(false);
  });
});
