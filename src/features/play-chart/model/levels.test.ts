import { describe, expect, it } from 'vitest';
import { LEVELS, levelOutcome, levelRate } from './levels';

describe('levels', () => {
  it('plays the song as written, then 12 % and 20 % faster', () => {
    expect(LEVELS).toBe(3);
    expect(levelRate(1)).toBe(1);
    expect(levelRate(2)).toBe(1.12);
    expect(levelRate(3)).toBe(1.2);
    expect(levelRate(9)).toBe(1.2);
  });

  it('earns a star per finished level and moves on; a fail keeps what was earned', () => {
    expect(levelOutcome(1, false)).toEqual({ stars: 1, next: 2 });
    expect(levelOutcome(2, false)).toEqual({ stars: 2, next: 3 });
    expect(levelOutcome(3, false)).toEqual({ stars: 3, next: null });
    expect(levelOutcome(1, true)).toEqual({ stars: 0, next: null });
    expect(levelOutcome(3, true)).toEqual({ stars: 2, next: null });
  });
});
