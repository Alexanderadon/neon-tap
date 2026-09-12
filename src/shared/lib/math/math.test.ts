import { describe, expect, it } from 'vitest';
import { clamp, fnv1a, lowerBound, median, mulberry32, percentile } from './index';

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

describe('rng', () => {
  it('fnv1a is deterministic, 32-bit and sensitive to the input', () => {
    expect(fnv1a('neon')).toBe(fnv1a('neon'));
    expect(fnv1a('neon')).not.toBe(fnv1a('neom'));
    expect(fnv1a('')).toBe(0x811c9dc5);
    for (const s of ['a', 'track-id', 'x'.repeat(100)]) {
      const h = fnv1a(s);
      expect(Number.isInteger(h) && h >= 0 && h <= 0xffffffff).toBe(true);
    }
  });

  it('mulberry32 repeats per seed, differs across seeds and stays in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    const seqC = Array.from({ length: 8 }, () => c());
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    for (const v of seqA) expect(v >= 0 && v < 1).toBe(true);
    // roughly uniform: mean of many draws near 0.5
    const r = mulberry32(7);
    let sum = 0;
    for (let i = 0; i < 5000; i++) sum += r();
    expect(Math.abs(sum / 5000 - 0.5)).toBeLessThan(0.03);
  });
});
