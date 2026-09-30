/** Period presets for the historical analysis filters (in the viewer's local date). */
export const PERIODS = [
  { value: 'all', label: 'All records' },
  { value: '12m', label: 'Last 12 months' },
  { value: '24m', label: 'Last 24 months' },
  { value: 'this_year', label: 'This year' },
  { value: 'last_year', label: 'Last year' },
] as const;

function iso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Date range for a preset; null values mean "no limit". */
export function periodRange(
  value: string,
  today: Date = new Date(),
): { from: string | null; to: string | null } | null {
  const year = today.getFullYear();
  switch (value) {
    case 'all':
      return { from: null, to: null };
    case '12m':
    case '24m': {
      const months = value === '12m' ? 12 : 24;
      // Whole calendar months: the current month and the months before it.
      return { from: iso(new Date(year, today.getMonth() - months + 1, 1)), to: iso(today) };
    }
    case 'this_year':
      return { from: `${year}-01-01`, to: iso(today) };
    case 'last_year':
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
    default:
      return null;
  }
}

/** Which preset the current dates match, or "custom". */
export function matchPeriod(from: string | null, to: string | null, today: Date = new Date()) {
  for (const period of PERIODS) {
    const range = periodRange(period.value, today)!;
    if (range.from === (from || null) && range.to === (to || null)) return period.value;
  }
  return 'custom';
}
