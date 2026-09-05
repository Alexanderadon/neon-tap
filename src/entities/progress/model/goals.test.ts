import { describe, expect, it } from 'vitest';
import { registerLocalTrackIds, resetLocalTrackIds } from '@/shared/lib/local-tracks';
import { GOALS, bonusStars, claimGoals, findGoal, goalProgress, goalStars, grandTotalStars, isGoalDone } from './goals';
import { emptySave, type BestResult, type SaveData } from './SaveData';

const res = (rank: BestResult['rank'], fullCombo = false, maxCombo = 10): BestResult => ({
  score: 1000,
  accuracy: 0.9,
  rank,
  maxCombo,
  fullCombo,
  playedAt: '2026-01-01',
});

const g = (id: string) => findGoal(id)!;

describe('goals', () => {
  it('is a fixed list of 8 goals with unique ids and dictionary copy', () => {
    expect(GOALS.length).toBe(8);
    expect(new Set(GOALS.map((x) => x.id)).size).toBe(8);
    for (const goal of GOALS) {
      expect(goal.title.length).toBeGreaterThan(0);
      expect(goal.description.length).toBeGreaterThan(0);
      expect(goal.target).toBeGreaterThan(0);
      expect(goal.reward).toBeGreaterThan(0);
      expect(goal.progress(emptySave())).toBe(0);
    }
    expect(findGoal('nope')).toBeUndefined();
  });

  it('evaluates track-based goals from the bests', () => {
    const save: SaveData = { ...emptySave(), tracks: { a: res('S'), b: res('SS', true), c: res('C'), d: res('D'), e: res('A'), f: res('B') } };
    expect(goalProgress(g('pass-5'), save)).toBe(5); // D is not a pass
    expect(isGoalDone(g('pass-5'), save)).toBe(true);
    expect(goalProgress(g('rank-s-3'), save)).toBe(2);
    expect(isGoalDone(g('rank-s-3'), save)).toBe(false);
    expect(goalProgress(g('full-combo'), save)).toBe(1);
    // stars: S3 + SS3 + C1 + A2 + B1 = 10, plus daily bonuses; goal rewards never count
    expect(goalProgress(g('stars-20'), { ...save, daily: { date: '', done: false, streak: 0, total: 4 }, goalsClaimed: ['pass-5'] })).toBe(14);
  });

  it('evaluates counter-based goals and clamps progress to the target', () => {
    const save: SaveData = {
      ...emptySave(),
      counters: { spells: { slow: 25, heart: 1 }, tracksPlayed: 9, maxCombo: 140, maxTrackStars: 5 },
      daily: { date: '2026-09-05', done: true, streak: 3, total: 3 },
    };
    expect(goalProgress(g('slow-10'), save)).toBe(10);
    expect(g('slow-10').progress(save)).toBe(25);
    expect(isGoalDone(g('combo-100'), save)).toBe(true);
    expect(isGoalDone(g('star-6'), save)).toBe(false);
    expect(isGoalDone(g('star-6'), { ...save, counters: { ...save.counters, maxTrackStars: 6 } })).toBe(true);
    expect(isGoalDone(g('daily-3'), save)).toBe(true);
  });

  it('claims rewards once and counts bonus stars', () => {
    const base: SaveData = { ...emptySave(), counters: { spells: { slow: 10, heart: 0 }, tracksPlayed: 1, maxCombo: 100, maxTrackStars: 0 } };
    const first = claimGoals(base);
    expect(first.claimed.map((x) => x.id).sort()).toEqual(['combo-100', 'slow-10']);
    expect(first.save.goalsClaimed.sort()).toEqual(['combo-100', 'slow-10']);
    expect(base.goalsClaimed).toEqual([]);

    const second = claimGoals(first.save);
    expect(second.claimed).toEqual([]);
    expect(second.save).toBe(first.save);

    expect(goalStars(first.save)).toBe(g('combo-100').reward + g('slow-10').reward);
    const withDaily = { ...first.save, daily: { ...first.save.daily, total: 2 }, tracks: { a: res('A') } };
    expect(bonusStars(withDaily)).toBe(goalStars(first.save) + 2);
    expect(grandTotalStars(withDaily)).toBe(2 + goalStars(first.save) + 2);
    expect(grandTotalStars(withDaily, [])).toBe(goalStars(first.save) + 2);
    // unknown claimed ids (removed goals) are worth nothing
    expect(goalStars({ ...base, goalsClaimed: ['gone'] })).toBe(0);
  });
});

describe('goals and local tracks (dev-only)', () => {
  it('ignores registered local ids in every track-based goal', () => {
    const save: SaveData = {
      ...emptySave(),
      tracks: { a: res('S', true), 'loc-1': res('SS', true), 'loc-2': res('S'), 'loc-3': res('A'), 'loc-4': res('B'), 'loc-5': res('C') },
    };
    // Before registration the ids look like ordinary tracks.
    expect(goalProgress(g('pass-5'), save)).toBe(5);
    expect(goalProgress(g('rank-s-3'), save)).toBe(3);
    expect(goalProgress(g('full-combo'), save)).toBe(1);
    expect(goalProgress(g('stars-20'), save)).toBe(3 + 3 + 3 + 2 + 1 + 1);

    registerLocalTrackIds(['loc-1', 'loc-2', 'loc-3', 'loc-4', 'loc-5']);
    try {
      expect(goalProgress(g('pass-5'), save)).toBe(1);
      expect(goalProgress(g('rank-s-3'), save)).toBe(1);
      expect(goalProgress(g('full-combo'), save)).toBe(1);
      expect(goalProgress(g('stars-20'), save)).toBe(3);
      expect(isGoalDone(g('pass-5'), save)).toBe(false);
      expect(claimGoals(save).claimed.map((x) => x.id)).toEqual(['full-combo']);
    } finally {
      resetLocalTrackIds();
    }
  });
});
