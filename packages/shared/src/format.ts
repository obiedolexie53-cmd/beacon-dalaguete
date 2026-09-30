import type { ReportSummary } from './api/types';

/** All incident dates and times are local to Dalaguete (Philippine Standard Time). */
export const DISPLAY_TIME_ZONE = 'Asia/Manila';
const LOCALE = 'en-PH';

/** "2026-09-28" + "16:35:00" → "September 28, 2026, 4:35 PM". */
export function formatIncidentDateTime(date: string, time: string | null): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour = 0, minute = 0] = (time ?? '').split(':').map(Number);
  // Build the wall-clock value in UTC and format it in UTC, so the viewer's own
  // time zone never shifts the incident's local date or time.
  const value = new Date(Date.UTC(year!, month! - 1, day!, hour, minute));
  const datePart = value.toLocaleDateString(LOCALE, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  if (!time) return datePart;
  const timePart = value.toLocaleTimeString(LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
  return `${datePart}, ${timePart.replace(/\s?([ap])\.?m\.?/i, (_, p: string) => ` ${p.toUpperCase()}M`)}`;
}

/** A submission timestamp shown in Philippine time, e.g. "Sep 28, 2026, 4:52 PM". */
export function formatTimestamp(iso: string): string {
  return new Date(iso)
    .toLocaleString(LOCALE, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: DISPLAY_TIME_ZONE,
    })
    .replace(/\s?([ap])\.?m\.?/i, (_, p: string) => ` ${p.toUpperCase()}M`);
}

/** Hazard name for display. "Other Hazard" reports show what the resident typed. */
export function hazardLabel(report: Pick<ReportSummary, 'hazard_type' | 'other_hazard_text'>) {
  return report.hazard_type.code === 'other' && report.other_hazard_text
    ? `Other: ${report.other_hazard_text}`
    : report.hazard_type.name;
}
