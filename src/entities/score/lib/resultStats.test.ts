import { describe, expect, it } from 'vitest';
import type { Judgement, ResultTimeline } from '@/shared/types/result';
import {
  accuracyCurve,
  comboCurve,
  densestSlice,
  firstMissTime,
  formatClock,
  longestStreak,
  runningAccuracy,
  sampleStep,
  summarizeTimeline,
  worstWindow,
} from './resultStats';

/** Build a timeline from a compact string: 'p' perfect, 'g' great, 'o' good, 'm' miss; one judgement per second. */
function tl(seq: string, step = 1): ResultTimeline {
  const map: Record<string, Judgement> = { p: 'perfect', g: 'great', o: 'good', m: 'miss' };
  const t: number[] = [];
  const j: Judgement[] = [];
  const combo: number[] = [];
  let c = 0;
  for (let i = 0; i < seq.length; i++) {
    const jud = map[seq[i]];
    c = jud === 'miss' ? 0 : c + 1;
    t.push(i * step);
    j.push(jud);
    combo.push(c);
  }
  return { t, j, combo };
}

const empty: ResultTimeline = { t: [], j: [], combo: [] };

describe('longestStreak', () => {
  it('finds the longest miss-free run with its time span', () => {
    const s = longestStreak(tl('ppmpppgmpo'));
    expect(s).toEqual({ from: 3, to: 6, count: 4, start: 3, end: 6 });
  });

  it('keeps the earliest streak on ties', () => {
    expect(longestStreak(tl('ppmpp'))).toMatchObject({ from: 0, to: 1, count: 2 });
  });

  it('covers the whole run when there are no misses', () => {
    expect(longestStreak(tl('pppp'))).toMatchObject({ from: 0, to: 3, count: 4 });
  });

  it('is null for an empty or all-miss run', () => {
    expect(longestStreak(empty)).toBeNull();
    expect(longestStreak(tl('mmm'))).toBeNull();
  });
});

describe('firstMissTime', () => {
  it('returns the time of the first miss, null without misses', () => {
    expect(firstMissTime(tl('ppgm', 0.5))).toBe(1.5);
    expect(firstMissTime(tl('ppg'))).toBeNull();
    expect(firstMissTime(empty)).toBeNull();
  });
});

describe('worstWindow', () => {
  it('finds the 10-second window with the most misses', () => {
    const missAt = new Set([2, 20, 23, 27, 40]);
    const s = tl(Array.from({ length: 41 }, (_, i) => (missAt.has(i) ? 'm' : 'p')).join(''));
    expect(worstWindow(s)).toEqual({ from: 20, to: 30, misses: 3 });
  });

  it('clips the window end to the song duration', () => {
    expect(worstWindow(tl('pppm'), 10, 5)).toEqual({ from: 3, to: 5, misses: 1 });
  });

  it('prefers the earliest window on ties and is null without misses', () => {
    expect(worstWindow(tl('mpppppppppppppppppppm'))).toMatchObject({ from: 0, misses: 1 });
    expect(worstWindow(tl('pp'))).toBeNull();
    expect(worstWindow(empty)).toBeNull();
  });
});

describe('runningAccuracy', () => {
  it('matches the accuracy weights judgement by judgement', () => {
    const a = runningAccuracy(tl('pgm'));
    expect(a[0]).toBeCloseTo(1);
    expect(a[1]).toBeCloseTo(500 / 600);
    expect(a[2]).toBeCloseTo(500 / 900);
    expect(runningAccuracy(empty)).toEqual([]);
  });
});

describe('sampleStep / curves', () => {
  it('holds each value until the next entry and uses the initial value before the first', () => {
    expect(sampleStep([1, 3], [10, 20], 4, 5, 0)).toEqual([0, 10, 10, 20, 20]);
    expect(sampleStep([], [], 4, 3, 7)).toEqual([7, 7, 7]);
    expect(sampleStep([0], [5], 4, 1, 0)).toEqual([5]);
    expect(sampleStep([0], [5], 4, 0, 0)).toEqual([]);
  });

  it('combo curve drops to zero at a miss, accuracy curve starts at 1', () => {
    const s = tl('ppmp');
    expect(comboCurve(s, 3, 4)).toEqual([1, 2, 0, 1]);
    const acc = accuracyCurve(s, 4, 5);
    expect(acc[0]).toBe(1);
    expect(acc[4]).toBeCloseTo(900 / 1200);
  });
});

describe('densestSlice', () => {
  it('centres a short range inside the slice and never starts before 0', () => {
    expect(densestSlice([], 10, 14, 8)).toEqual({ from: 8, to: 16 });
    expect(densestSlice([], 1, 3, 8)).toEqual({ from: 0, to: 8 });
  });

  it('picks the slice with the most events inside a long range', () => {
    const times = [0, 1, 2, 10, 11, 12, 13, 14, 15, 16, 30];
    expect(densestSlice(times, 0, 30, 8)).toEqual({ from: 10, to: 18 });
  });

  it('falls back to the range start when no event lies in the range', () => {
    expect(densestSlice([50], 0, 30, 8)).toEqual({ from: 0, to: 8 });
  });
});

describe('summarizeTimeline / formatClock', () => {
  it('aggregates the highlights', () => {
    const h = summarizeTimeline(tl('pppmpp'), 6);
    expect(h.bestStreak).toMatchObject({ count: 3, from: 0, to: 2 });
    expect(h.firstMiss).toBe(3);
    expect(h.worstWindow).toEqual({ from: 3, to: 6, misses: 1 });
  });

  it('formats m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65.9)).toBe('1:05');
    expect(formatClock(600)).toBe('10:00');
    expect(formatClock(-3)).toBe('0:00');
  });
});
