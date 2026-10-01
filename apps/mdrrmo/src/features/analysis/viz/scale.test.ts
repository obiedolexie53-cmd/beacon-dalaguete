import { describe, expect, it } from 'vitest';
import { heatLegend, heatStep, niceTicks } from './scale';

describe('heat scale', () => {
  it('bins counts into six steps with zero left empty', () => {
    expect(heatStep(0, 12)).toBeNull();
    expect(heatStep(1, 12)).toBe(0);
    expect(heatStep(12, 12)).toBe(5);
    expect(heatStep(6, 12)).toBe(2);
  });
  it('describes each reachable step in the legend', () => {
    expect(heatLegend(3)).toEqual([
      { index: 1, from: 1, to: 1 },
      { index: 3, from: 2, to: 2 },
      { index: 5, from: 3, to: 3 },
    ]);
    const twelve = heatLegend(12);
    expect(twelve[0]).toEqual({ index: 0, from: 1, to: 2 });
    expect(twelve.at(-1)).toEqual({ index: 5, from: 11, to: 12 });
  });
  it('makes clean ticks', () => {
    expect(niceTicks(32)).toEqual([0, 10, 20, 30, 40]);
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});
