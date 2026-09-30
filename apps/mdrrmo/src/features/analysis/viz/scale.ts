/**
 * Sequential blue ramp for magnitude (steps from the dataviz reference palette).
 * Steps 400/450 are skipped: neither navy nor white text reaches 4.5:1 on them,
 * and every cell carries its number as text.
 */
export const HEAT_STEPS = [
  { step: 100, fill: '#cde2fb', ink: 'dark' },
  { step: 200, fill: '#9ec5f4', ink: 'dark' },
  { step: 300, fill: '#6da7ec', ink: 'dark' },
  { step: 500, fill: '#256abf', ink: 'light' },
  { step: 600, fill: '#184f95', ink: 'light' },
  { step: 700, fill: '#0d366b', ink: 'light' },
] as const;

/** Index into HEAT_STEPS for a count, or null for zero. */
export function heatStep(value: number, max: number): number | null {
  if (value <= 0 || max <= 0) return null;
  return Math.min(HEAT_STEPS.length, Math.max(1, Math.ceil((value / max) * HEAT_STEPS.length))) - 1;
}

/** Value ranges per step for the legend, leaving out steps no whole count can reach. */
export function heatLegend(max: number): Array<{ index: number; from: number; to: number }> {
  const out: Array<{ index: number; from: number; to: number }> = [];
  for (let value = 1; value <= max; value++) {
    const index = heatStep(value, max)!;
    const last = out[out.length - 1];
    if (last && last.index === index) last.to = value;
    else out.push({ index, from: value, to: value });
  }
  return out;
}

/** Clean y-axis ticks from 0 to at least `max` (1, 2 or 5 × a power of ten). */
export function niceTicks(max: number, target = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let t = 0; t < max + step; t += step) ticks.push(Math.max(0, Math.round(t * 1000) / 1000));
  return ticks;
}
