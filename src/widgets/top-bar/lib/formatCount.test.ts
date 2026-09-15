import { describe, expect, it } from 'vitest';
import { formatCount, formatDelta } from './formatCount';

describe('formatCount', () => {
  it('groups thousands with a thin space and rounds', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(758)).toBe('758');
    expect(formatCount(1240)).toBe('1 240');
    expect(formatCount(102400)).toBe('102 400');
    expect(formatCount(9999.6)).toBe('10 000');
  });

  it('writes a proper minus and a plus for deltas', () => {
    expect(formatCount(-12)).toBe('−12');
    expect(formatDelta(35)).toBe('+35');
    expect(formatDelta(-1200)).toBe('−1 200');
  });
});
