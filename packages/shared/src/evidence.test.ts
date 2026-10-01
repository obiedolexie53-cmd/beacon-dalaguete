import { describe, expect, it } from 'vitest';
import { formatBytes } from './evidence';

describe('formatBytes', () => {
  it('uses KB and MB', () => {
    expect(formatBytes(500)).toBe('1 KB');
    expect(formatBytes(820 * 1024)).toBe('820 KB');
    expect(formatBytes(1.4 * 1024 * 1024)).toBe('1.4 MB');
    expect(formatBytes(50 * 1024 * 1024)).toBe('50 MB');
  });
});
