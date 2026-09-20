import { describe, expect, it } from 'vitest';
import { ENDLESS_MAX_RATE, LEVELS, levelOutcome, levelRate } from './levels';

describe('levels', () => {
  it('plays the song as written, then 12 % and 20 % faster', () => {
    expect(LEVELS).toBe(3);
    expect(levelRate(1)).toBe(1);
    expect(levelRate(2)).toBe(1.12);
    expect(levelRate(3)).toBe(1.2);
  });

  it('endless loops come back 5 % faster each, up to the cap', () => {
    expect(levelRate(4)).toBe(1.25);
    expect(levelRate(5)).toBe(1.3);
    expect(levelRate(11)).toBe(ENDLESS_MAX_RATE);
    expect(levelRate(40)).toBe(ENDLESS_MAX_RATE);
  });

  it('earns a star per finished level and moves on; a fail keeps what was earned', () => {
    expect(levelOutcome(1, false)).toEqual({ stars: 1, crowns: 0, next: 2 });
    expect(levelOutcome(2, false)).toEqual({ stars: 2, crowns: 0, next: 3 });
    expect(levelOutcome(3, false)).toEqual({ stars: 3, crowns: 0, next: null });
    expect(levelOutcome(1, true)).toEqual({ stars: 0, crowns: 0, next: null });
    expect(levelOutcome(3, true)).toEqual({ stars: 2, crowns: 0, next: null });
  });

  it('in endless mode the third star opens loop four, and every loop past it is a crown', () => {
    expect(levelOutcome(3, false, true)).toEqual({ stars: 3, crowns: 0, next: 4 });
    expect(levelOutcome(4, false, true)).toEqual({ stars: 3, crowns: 1, next: 5 });
    expect(levelOutcome(6, false, true)).toEqual({ stars: 3, crowns: 3, next: 7 });
    // A fail on loop five keeps the crown of loop four; a fail on loop four keeps the three stars.
    expect(levelOutcome(5, true, true)).toEqual({ stars: 3, crowns: 1, next: null });
    expect(levelOutcome(4, true, true)).toEqual({ stars: 3, crowns: 0, next: null });
  });
});
