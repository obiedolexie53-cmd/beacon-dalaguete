import { describe, expect, it } from 'vitest';
import {
  earliestIncidentDate,
  localNow,
  validateDetailsStep,
  validateHazardStep,
  validateLocationStep,
} from './reportRules';
import { uuidv4 } from './uuid';

// 2026-09-30 10:00 in Manila (UTC+8)
const NOW = new Date('2026-09-30T02:00:00Z');

describe('localNow', () => {
  it('uses Dalaguete time regardless of the device time zone', () => {
    expect(localNow(new Date('2026-09-30T17:30:00Z'))).toEqual({
      date: '2026-10-01',
      time: '01:30',
    });
  });
});

describe('validateHazardStep', () => {
  it('requires a hazard', () => {
    expect(validateHazardStep({ hazardCode: null, otherHazardText: '' })).toHaveProperty('hazard');
    expect(validateHazardStep({ hazardCode: 'flood', otherHazardText: '' })).toEqual({});
  });

  it('requires a short description for Other Hazard', () => {
    expect(validateHazardStep({ hazardCode: 'other', otherHazardText: ' a ' })).toHaveProperty(
      'otherHazardText',
    );
    expect(validateHazardStep({ hazardCode: 'other', otherHazardText: 'Sinkhole' })).toEqual({});
  });
});

describe('validateDetailsStep', () => {
  const valid = {
    description: 'Water is knee-deep on the main road.',
    incidentDate: '2026-09-30',
    incidentTime: '09:15',
  };

  it('accepts a valid incident', () => {
    expect(validateDetailsStep(valid, NOW)).toEqual({});
  });

  it('requires a meaningful description', () => {
    expect(validateDetailsStep({ ...valid, description: '  flood  ' }, NOW)).toHaveProperty(
      'description',
    );
  });

  it('rejects future dates and times, allowing a little clock skew', () => {
    expect(validateDetailsStep({ ...valid, incidentDate: '2026-10-01' }, NOW)).toHaveProperty(
      'incidentDate',
    );
    expect(validateDetailsStep({ ...valid, incidentTime: '11:00' }, NOW)).toHaveProperty(
      'incidentTime',
    );
    expect(validateDetailsStep({ ...valid, incidentTime: '10:04' }, NOW)).toEqual({});
    expect(
      validateDetailsStep({ ...valid, incidentDate: '2026-09-29', incidentTime: '23:00' }, NOW),
    ).toEqual({});
  });

  it('rejects incidents older than a year', () => {
    expect(earliestIncidentDate(NOW)).toBe('2025-09-30');
    expect(validateDetailsStep({ ...valid, incidentDate: '2025-09-29' }, NOW)).toHaveProperty(
      'incidentDate',
    );
  });

  it('requires date and time', () => {
    const errors = validateDetailsStep({ ...valid, incidentDate: '', incidentTime: '' }, NOW);
    expect(Object.keys(errors).sort()).toEqual(['incidentDate', 'incidentTime']);
  });
});

describe('uuidv4', () => {
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('produces v4 UUIDs', () => {
    expect(uuidv4()).toMatch(pattern);
  });

  it('works without crypto.randomUUID (plain-HTTP local network testing)', () => {
    const original = crypto.randomUUID;
    try {
      Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
      const ids = new Set(Array.from({ length: 50 }, () => uuidv4()));
      expect(ids.size).toBe(50);
      for (const id of ids) expect(id).toMatch(pattern);
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
    }
  });
});

describe('validateLocationStep', () => {
  const base = { barangayId: 23, landmark: '', latitude: 9.8412, longitude: 123.4873 };

  it('accepts a pin inside Dalaguete without a landmark', () => {
    expect(validateLocationStep(base)).toEqual({});
  });

  it('requires a barangay', () => {
    expect(validateLocationStep({ ...base, barangayId: null })).toHaveProperty('barangay');
  });

  it('needs a landmark when there is no pin (e.g. location permission denied)', () => {
    const noPin = { ...base, latitude: null, longitude: null };
    expect(validateLocationStep(noPin)).toHaveProperty('landmark');
    expect(validateLocationStep({ ...noPin, landmark: 'Near the chapel' })).toEqual({});
  });

  it('flags pins outside Dalaguete', () => {
    // Cebu City
    expect(
      validateLocationStep({ ...base, latitude: 10.3157, longitude: 123.8854 }),
    ).toHaveProperty('map');
  });
});
