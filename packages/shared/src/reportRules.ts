/**
 * Report form rules. Mirrors backend/app/reports/validation.py and schemas.py.
 * The server re-checks everything; these give residents instant feedback.
 */
import { OTHER_HAZARD_CODE } from './hazards';
import { inServiceArea } from './location';

export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 2000;
export const OTHER_HAZARD_MIN = 3;
export const OTHER_HAZARD_MAX = 120;
export const LANDMARK_MIN = 3;
export const LANDMARK_MAX = 200;
export const MAX_INCIDENT_AGE_DAYS = 365;
const CLOCK_SKEW_MINUTES = 5;

const LOCAL_TIME_ZONE = 'Asia/Manila';

/** Current date ("YYYY-MM-DD") and time ("HH:MM") in Dalaguete, whatever the device time zone. */
export function localNow(now: Date = new Date()): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: LOCAL_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const value = new Date(Date.UTC(y!, m! - 1, d! + days));
  return value.toISOString().slice(0, 10);
}

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h! * 60 + m!;
}

export interface HazardStepInput {
  hazardCode: string | null;
  otherHazardText: string;
}

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function validateHazardStep(
  input: HazardStepInput,
): FieldErrors<'hazard' | 'otherHazardText'> {
  if (!input.hazardCode) return { hazard: 'Select the type of hazard' };
  if (input.hazardCode === OTHER_HAZARD_CODE) {
    const text = input.otherHazardText.trim();
    if (text.length < OTHER_HAZARD_MIN) {
      return { otherHazardText: 'Describe the hazard in a few words' };
    }
    if (text.length > OTHER_HAZARD_MAX) {
      return { otherHazardText: `Use at most ${OTHER_HAZARD_MAX} characters` };
    }
  }
  return {};
}

export interface DetailsStepInput {
  description: string;
  incidentDate: string;
  incidentTime: string;
}

export function validateDetailsStep(
  input: DetailsStepInput,
  now: Date = new Date(),
): FieldErrors<'description' | 'incidentDate' | 'incidentTime'> {
  const errors: FieldErrors<'description' | 'incidentDate' | 'incidentTime'> = {};
  const description = input.description.trim();
  if (description.length < DESCRIPTION_MIN) {
    errors.description = `Describe what happened in at least ${DESCRIPTION_MIN} characters`;
  } else if (description.length > DESCRIPTION_MAX) {
    errors.description = `Keep the description under ${DESCRIPTION_MAX} characters`;
  }

  const today = localNow(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.incidentDate)) {
    errors.incidentDate = 'Enter the date of the incident';
  } else if (input.incidentDate > today.date) {
    errors.incidentDate = 'The incident date cannot be in the future';
  } else if (input.incidentDate < addDays(today.date, -MAX_INCIDENT_AGE_DAYS)) {
    errors.incidentDate = 'The incident date must be within the past year';
  }

  if (!/^\d{2}:\d{2}$/.test(input.incidentTime)) {
    errors.incidentTime = 'Enter the approximate time of the incident';
  } else if (
    input.incidentDate === today.date &&
    minutesOf(input.incidentTime) > minutesOf(today.time) + CLOCK_SKEW_MINUTES
  ) {
    errors.incidentTime = 'The incident time cannot be in the future';
  }
  return errors;
}

/** Earliest date a resident may pick for an incident. */
export function earliestIncidentDate(now: Date = new Date()): string {
  return addDays(localNow(now).date, -MAX_INCIDENT_AGE_DAYS);
}

export interface LocationStepInput {
  barangayId: number | null;
  landmark: string;
  latitude: number | null;
  longitude: number | null;
}

export function validateLocationStep(
  input: LocationStepInput,
): FieldErrors<'barangay' | 'landmark' | 'map'> {
  const errors: FieldErrors<'barangay' | 'landmark' | 'map'> = {};
  if (!input.barangayId) errors.barangay = 'Select the barangay where the incident happened';
  const hasPin = input.latitude !== null && input.longitude !== null;
  if (hasPin && !inServiceArea(input.latitude!, input.longitude!)) {
    errors.map = 'The pin appears to be outside Dalaguete. Move it to the incident location.';
  }
  const landmark = input.landmark.trim();
  if (landmark.length > LANDMARK_MAX) {
    errors.landmark = `Use at most ${LANDMARK_MAX} characters`;
  } else if (!hasPin && landmark.length < LANDMARK_MIN) {
    errors.landmark = 'Add a nearby landmark, or set the location on the map';
  }
  return errors;
}
