import { describe, expect, it } from 'vitest';
import { GOALS, bonusStars, claimGoals, findGoal, goalProgress, grandTotalStars, isGoalDone, nextGoals } from './goals';
import { EMPTY_COUNTERS, emptySave, type BestResult, type SaveData } from './SaveData';

const res = (rank: BestResult['rank'], fullCombo = false, maxCombo = 10): BestResult => ({
  score: 1000,
  accuracy: 0.9,
  rank,
  maxCombo,
  fullCombo,
  playedAt: '2026-01-01',
});

const g = (id: string) => findGoal(id)!;

describe('achievements', () => {
  it('is a ladder of exactly 100 badges with unique ids, ascending tiers and copy', () => {
    expect(GOALS.length).toBe(100);
    expect(new Set(GOALS.map((x) => x.id)).size).toBe(100);
    const families = new Set(GOALS.map((x) => x.family));
    expect(families.size).toBe(15);
    for (const family of families) {
      const ladder = GOALS.filter((x) => x.family === family);
      for (let i = 1; i < ladder.length; i++) {
        expect(ladder[i].target).toBeGreaterThan(ladder[i - 1].target);
        expect(ladder[i].tier).toBe(ladder[i - 1].tier + 1);
        expect(ladder[i].reward).toBeGreaterThanOrEqual(ladder[i - 1].reward);
      }
    }
    for (const goal of GOALS) {
      expect(goal.title).toContain(String(goal.target));
      expect(goal.description.length).toBeGreaterThan(0);
      expect(goal.reward).toBeGreaterThan(0);
      expect(goal.progress(emptySave())).toBe(0);
    }
    expect(findGoal('nope')).toBeUndefined();
  });

  it('evaluates track-based badges from the bests', () => {
    const save: SaveData = { ...emptySave(), tracks: { a: res('S'), b: res('SS', true), c: res('C'), d: res('D'), e: res('A'), f: res('B') } };
    expect(goalProgress(g('pass-5'), save)).toBe(5); // D is not a pass
    expect(isGoalDone(g('pass-5'), save)).toBe(true);
    expect(isGoalDone(g('pass-10'), save)).toBe(false);
    expect(goalProgress(g('rankS-3'), save)).toBe(2);
    expect(goalProgress(g('fullCombo-1'), save)).toBe(1);
    // stars: S3 + SS3 + C1 + A2 + B1 = 10, plus daily bonuses
    expect(goalProgress(g('stars-20'), { ...save, daily: { date: '', done: false, streak: 0, total: 4 } })).toBe(14);
  });

  it('evaluates counter-based badges and clamps progress to the target', () => {
    const save: SaveData = {
      ...emptySave(),
      counters: { ...EMPTY_COUNTERS, spells: { slow: 25, heart: 1 }, maxCombo: 140, maxTrackStars: 5, genres: ['rock', 'jazz'], perfects: 600, customPlays: 1 },
      daily: { date: '2026-09-05', done: true, streak: 3, total: 3 },
      plays: 30,
    };
    expect(goalProgress(g('slow-10'), save)).toBe(10);
    expect(g('slow-10').progress(save)).toBe(25);
    expect(isGoalDone(g('combo-100'), save)).toBe(true);
    expect(isGoalDone(g('combo-150'), save)).toBe(false);
    expect(isGoalDone(g('hardest-5'), save)).toBe(true);
    expect(isGoalDone(g('hardest-6'), save)).toBe(false);
    expect(isGoalDone(g('daily-3'), save)).toBe(true);
    expect(isGoalDone(g('genres-2'), save)).toBe(true);
    expect(isGoalDone(g('perfects-500'), save)).toBe(true);
    expect(isGoalDone(g('attempts-25'), save)).toBe(true);
    expect(isGoalDone(g('custom-1'), save)).toBe(true);
  });

  it('claims every newly reached tier once and pays crystals, never stars', () => {
    const base: SaveData = { ...emptySave(), counters: { ...EMPTY_COUNTERS, spells: { slow: 10, heart: 0 }, maxCombo: 100 } };
    const first = claimGoals(base);
    expect(first.claimed.map((x) => x.id).sort()).toEqual(['combo-100', 'combo-25', 'combo-50', 'slow-10', 'slow-5']);
    const reward = first.claimed.reduce((s, x) => s + x.reward, 0);
    expect(first.save.crystals).toBe(reward);
    expect(first.save.lifetimeCrystals).toBe(reward);
    expect(base.goalsClaimed).toEqual([]);
    // the reward itself climbs the crystal ladder (85 crystals → the 50 tier), then the ladder rests
    const second = claimGoals(first.save);
    expect(second.claimed.map((x) => x.id)).toEqual(['crystals-50']);
    const third = claimGoals(second.save);
    expect(third.claimed).toEqual([]);
    expect(third.save).toBe(second.save);
    // badges do not feed the star total (unlocks stay honest)
    expect(bonusStars(first.save)).toBe(0);
    expect(grandTotalStars({ ...first.save, daily: { date: '', done: false, streak: 0, total: 2 } })).toBe(2);
  });

  it('lists the next unearned tier of every family, in family order', () => {
    const save: SaveData = { ...emptySave(), counters: { ...EMPTY_COUNTERS, maxCombo: 60 } };
    const next = nextGoals(save);
    expect(next.length).toBe(15);
    expect(next.find((x) => x.family === 'combo')?.id).toBe('combo-100');
    expect(next.find((x) => x.family === 'pass')?.id).toBe('pass-1');
    expect(new Set(next.map((x) => x.family)).size).toBe(15);
  });
});
