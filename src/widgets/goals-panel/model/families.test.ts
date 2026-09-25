import { describe, expect, it } from 'vitest';
import { GOALS, type SaveData } from '@/entities/progress';
import { familyLadders, goalsGotLine, orderLadders } from './families';

const save: SaveData = {
  version: 6,
  tracks: {},
  plays: 12,
  counters: { spells: { slow: 0, heart: 0 }, tracksPlayed: 0, maxCombo: 64, maxTrackStars: 0, genres: [], perfects: 0, customPlays: 0, bought: 0 },
  daily: { date: '', done: false, streak: 0, total: 0 },
  goalsClaimed: [],
  crystals: 0,
  lifetimeCrystals: 0,
  purchased: [],
  earnings: { date: '', run: 0, custom: 0 },
  calendar: { count: 0, date: '' },
};

describe('achievement ladders', () => {
  it('builds one ladder per family with the next tier and its progress', () => {
    const ladders = familyLadders(save);
    expect(ladders.map((l) => l.family)).toEqual([...new Set(GOALS.map((g) => g.family))]);
    const combo = ladders.find((l) => l.family === 'combo')!;
    expect(combo.done).toBe(2); // 25 and 50 reached with a best combo of 64
    expect(combo.next?.target).toBe(100);
    expect(combo.value).toBe(64);
    expect(combo.ratio).toBeCloseTo(0.64);
    const attempts = ladders.find((l) => l.family === 'attempts')!;
    expect(attempts.done).toBe(1);
    expect(attempts.next?.target).toBe(25);
  });

  it('orders by closeness to the next tier and sinks complete families', () => {
    const ladders = familyLadders(save);
    const complete = { ...ladders[0], next: undefined, ratio: 1 };
    const ordered = orderLadders([complete, ...ladders.slice(1)]);
    expect(ordered[ordered.length - 1]).toBe(complete);
    for (let i = 1; i < ordered.length - 1; i++) expect(ordered[i - 1].ratio).toBeGreaterThanOrEqual(ordered[i].ratio);
  });

  it('never reads more than the list holds: an old save keeps retired ids (pass-59, rankS-59)', () => {
    const claimed = [...GOALS.map((g) => g.id), 'pass-59', 'rankS-59'];
    expect(goalsGotLine(claimed)).toBe(`получено ${GOALS.length} из ${GOALS.length}`);
    expect(goalsGotLine(['pass-1', 'pass-59'])).toBe(`получено 1 из ${GOALS.length}`);
  });
});
