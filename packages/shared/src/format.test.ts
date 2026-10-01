import { describe, expect, it } from 'vitest';
import { formatIncidentDateTime, formatTimestamp, hazardLabel } from './format';

describe('formatIncidentDateTime', () => {
  it('formats the local incident date and time', () => {
    expect(formatIncidentDateTime('2026-09-28', '16:35:00')).toBe('September 28, 2026, 4:35 PM');
    expect(formatIncidentDateTime('2026-01-05', '00:05:00')).toBe('January 5, 2026, 12:05 AM');
  });

  it('omits the time when unknown', () => {
    expect(formatIncidentDateTime('2026-09-28', null)).toBe('September 28, 2026');
  });
});

describe('formatTimestamp', () => {
  it('shows submissions in Philippine time regardless of the viewer', () => {
    expect(formatTimestamp('2026-09-28T08:52:00Z')).toBe('Sep 28, 2026, 4:52 PM');
  });
});

describe('hazardLabel', () => {
  const flood = { id: 1, code: 'flood', name: 'Flood' };
  const other = { id: 9, code: 'other', name: 'Other Hazard' };
  it('uses the hazard name, or the resident description for Other Hazard', () => {
    expect(hazardLabel({ hazard_type: flood, other_hazard_text: null })).toBe('Flood');
    expect(hazardLabel({ hazard_type: other, other_hazard_text: 'Sinkhole' })).toBe(
      'Other: Sinkhole',
    );
  });
});
