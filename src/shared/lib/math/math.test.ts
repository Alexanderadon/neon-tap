import { describe, expect, it } from 'vitest';
import { clamp, lowerBound, median, percentile } from './index';

describe('math', () => {
  it('median handles odd, even and empty input', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it('clamp bounds values', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('percentile picks nearest-rank element', () => {
    expect(percentile([10, 20, 30, 40, 50], 0.5)).toBe(30);
    expect(percentile([10, 20, 30, 40, 50], 1)).toBe(50);
  });

  it('lowerBound returns first index >= value', () => {
    expect(lowerBound([1, 2, 4, 8], 4)).toBe(2);
    expect(lowerBound([1, 2, 4, 8], 5)).toBe(3);
    expect(lowerBound([1, 2, 4, 8], 100)).toBe(4);
  });
});
