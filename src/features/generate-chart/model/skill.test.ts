import { describe, expect, it } from 'vitest';
import type { BestResult } from '@/entities/progress';
import { SKILL_FLOOR, skillStars } from './skill';

const CATALOG = [
  { id: 'calm', stars: 1 },
  { id: 'mid', stars: 4 },
  { id: 'wild', stars: 6 },
];

const run = (stars: number): BestResult => ({ score: 1000, accuracy: 0.9, rank: 'A', maxCombo: 10, fullCombo: false, playedAt: '2026-09-26T10:00:00Z', stars });

describe('own song ceiling by skill', () => {
  it('is ★2 for a newcomer, whatever the song', () => {
    expect(skillStars({}, CATALOG)).toBe(SKILL_FLOOR);
    expect(SKILL_FLOOR).toBe(2);
  });

  it('is one above the hardest passed catalog track; a failed try does not count', () => {
    expect(skillStars({ calm: run(1) }, CATALOG)).toBe(2);
    expect(skillStars({ calm: run(3), mid: run(1) }, CATALOG)).toBe(5);
    expect(skillStars({ mid: run(0) }, CATALOG)).toBe(2);
  });

  it('never goes over ★6, and ignores ids outside the catalog (own songs)', () => {
    expect(skillStars({ wild: run(2) }, CATALOG)).toBe(6);
    expect(skillStars({ 'custom:abc': run(3) }, CATALOG)).toBe(2);
  });
});
