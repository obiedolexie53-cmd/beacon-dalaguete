import { localNow, uuidv4 } from '@beacon/shared';

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
  updatedAt: string;
}

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
    return isDraft(parsed) ? parsed : null;
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

/** Remove every saved draft on this device (used on logout, for shared phones). */
export function clearAllDrafts(): void {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(KEY_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    /* storage unavailable */
  }
}
