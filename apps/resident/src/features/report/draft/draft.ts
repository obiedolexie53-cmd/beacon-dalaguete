import { localNow, uuidv4 } from '@beacon/shared';
import { clearAllEvidence } from '../evidence/evidenceStore';

/**
 * An unsent report, saved on this device only so a resident can finish it
 * later (e.g. after losing signal). Drafts are tied to one resident and deleted
 * on logout and after submission.
 */
export interface ReportDraft {
  version: 1;
  /** Sent with the report so a retried submission never creates a duplicate. */
  clientRequestId: string;
  hazardTypeId: number | null;
  hazardCode: string | null;
  hazardName: string | null;
  otherHazardText: string;
  description: string;
  incidentDate: string;
  incidentTime: string;
  barangayId: number | null;
  barangayName: string | null;
  landmark: string;
  latitude: number | null;
  longitude: number | null;
  locationAccuracyM: number | null;
  locationSource: 'gps' | 'map_pin' | null;
  updatedAt: string;
}

const LOCATION_DEFAULTS = {
  barangayId: null,
  barangayName: null,
  landmark: '',
  latitude: null,
  longitude: null,
  locationAccuracyM: null,
  locationSource: null,
} satisfies Partial<ReportDraft>;

const KEY_PREFIX = 'beacon.reportDraft.';

export function newDraft(now: Date = new Date()): ReportDraft {
  const local = localNow(now);
  return {
    version: 1,
    clientRequestId: uuidv4(),
    hazardTypeId: null,
    hazardCode: null,
    hazardName: null,
    otherHazardText: '',
    description: '',
    incidentDate: local.date,
    incidentTime: local.time,
    ...LOCATION_DEFAULTS,
    updatedAt: now.toISOString(),
  };
}

function isDraft(value: unknown): value is ReportDraft {
  const d = value as Partial<ReportDraft> | null;
  return !!d && d.version === 1 && typeof d.clientRequestId === 'string';
}

// Storage can be unavailable (private browsing, storage blocked); drafts then
// simply last for the current visit.
export function loadDraft(userId: string): ReportDraft | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + userId);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    // Drafts saved before the location step existed get empty location fields.
    return isDraft(parsed) ? { ...LOCATION_DEFAULTS, ...parsed } : null;
  } catch {
    return null;
  }
}

export function saveDraft(userId: string, draft: ReportDraft): void {
  try {
    localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(draft));
  } catch {
    /* storage unavailable or full */
  }
}

export function clearDraft(userId: string): void {
  try {
    localStorage.removeItem(KEY_PREFIX + userId);
  } catch {
    /* storage unavailable */
  }
}

/** Remove every saved draft and its photos/videos from this device (logout, shared phones). */
export function clearAllDrafts(): void {
  void clearAllEvidence();
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(KEY_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    /* storage unavailable */
  }
}
