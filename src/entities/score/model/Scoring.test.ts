import { describe, expect, it } from 'vitest';
import { Scoring, accuracyOf, judgeDelta, notesToReach, rankOf } from './Scoring';

describe('judgeDelta', () => {
  it('classifies by GDD windows', () => {
    expect(judgeDelta(0.03)).toBe('perfect');
    expect(judgeDelta(-0.05)).toBe('perfect');
    expect(judgeDelta(0.08)).toBe('great');
    expect(judgeDelta(0.1)).toBe('great');
    expect(judgeDelta(0.12)).toBe('good');
    expect(judgeDelta(0.15)).toBe('good');
    expect(judgeDelta(0.2)).toBeNull();
  });
});

describe('accuracy and rank', () => {
  it('computes weighted accuracy', () => {
    expect(accuracyOf({ perfect: 10, great: 0, good: 0, miss: 0 })).toBe(1);
    expect(accuracyOf({ perfect: 5, great: 0, good: 0, miss: 5 })).toBe(0.5);
    expect(accuracyOf({ perfect: 0, great: 3, good: 0, miss: 0 })).toBeCloseTo(2 / 3);
  });

  it('maps accuracy to ranks', () => {
    expect(rankOf(1)).toBe('SS');
    expect(rankOf(0.96)).toBe('S');
    expect(rankOf(0.9)).toBe('A');
    expect(rankOf(0.85)).toBe('B');
    expect(rankOf(0.7)).toBe('C');
    expect(rankOf(0.69)).toBe('D');
  });
});

describe('notesToReach', () => {
  it('counts the notes missing for rank S', () => {
    // 100 notes, 2 misses → 98% accuracy → already S.
    expect(notesToReach({ perfect: 98, great: 0, good: 0, miss: 2 }, 0.95)).toBe(0);
    // 100 notes, 8 misses → 92% → need 2 misses fixed → 94%... need 3 → 95%.
    expect(notesToReach({ perfect: 92, great: 0, good: 0, miss: 8 }, 0.95)).toBe(3);
    // 10 greats only → 66.7%; fix 9 greats → (9*300+200)/3000 = 96.7%
    expect(notesToReach({ perfect: 0, great: 10, good: 0, miss: 0 }, 0.95)).toBe(9);
  });
});

describe('Scoring', () => {
  it('tracks combo, max combo and score with multiplier', () => {
    const s = new Scoring(5);
    s.register('perfect');
    s.register('great');
    s.register('miss');
    s.register('good');
    s.register('perfect');
    expect(s.combo).toBe(2);
    expect(s.maxCombo).toBe(2);
    expect(s.counts).toEqual({ perfect: 2, great: 1, good: 1, miss: 1 });
    expect(s.score).toBe(300 + 200 + 100 + 300);
    expect(s.isFullCombo).toBe(false);
    expect(s.progress).toBe(1);
  });

  it('applies combo multiplier after 50', () => {
    const s = new Scoring(60);
    for (let i = 0; i < 50; i++) s.register('perfect');
    const before = s.score;
    s.register('perfect');
    expect(s.score - before).toBe(375);
  });

  it('forgives bonus items that went by: they leave the total, so full combo and progress stay reachable', () => {
    const s = new Scoring(3);
    s.register('perfect');
    s.forgive();
    s.register('great');
    expect(s.totalNotes).toBe(2);
    expect(s.isFullCombo).toBe(true);
    expect(s.progress).toBe(1);
    s.reset();
    expect(s.totalNotes).toBe(3);
  });
});
