import { describe, expect, it } from 'vitest';
import { registerLocalTrackIds, resetLocalTrackIds } from '@/shared/lib/local-tracks';
import { EMPTY_SAVE, addRun, addSpell, countedTrackIds, emptySave, mergeResult, migrate, starsForTrack, totalStars, type BestResult } from './SaveData';

const res = (rank: BestResult['rank'], score = 1000, maxCombo = 10): BestResult => ({
  score,
  accuracy: 0.9,
  rank,
  maxCombo,
  fullCombo: false,
  playedAt: '2026-01-01',
});

describe('SaveData', () => {
  it('migrates v1 (three charts per track) up to the current version keeping the best result', () => {
    const v1 = { version: 1, tracks: { a: { easy: res('B', 900), hard: res('A', 500) }, b: { normal: res('D', 50) } }, plays: 3 };
    const out = migrate(v1);
    expect(out.version).toBe(3);
    expect(out.tracks.a.rank).toBe('A');
    expect(out.tracks.b.rank).toBe('D');
    expect(out.plays).toBe(3);
    expect(migrate(null)).toEqual(EMPTY_SAVE);
    expect(migrate('nope')).toEqual(EMPTY_SAVE);
  });

  it('migrates v2 to v3 with back-filled counters, empty daily state and no claimed goals', () => {
    const v2 = { version: 2, tracks: { a: res('A', 900, 120), b: res('D', 50, 40), c: res('C', 300, 77) }, plays: 9 };
    const out = migrate(v2);
    expect(out.version).toBe(3);
    expect(out.tracks).toEqual(v2.tracks);
    expect(out.plays).toBe(9);
    // derived from the stored bests: best combo ever, passes (rank ≥ C)
    expect(out.counters).toEqual({ spells: { slow: 0, heart: 0 }, tracksPlayed: 2, maxCombo: 120, maxTrackStars: 0 });
    expect(out.daily).toEqual({ date: '', done: false, streak: 0, total: 0 });
    expect(out.goalsClaimed).toEqual([]);
  });

  it('keeps v3 data and sanitises garbage fields', () => {
    const v3 = {
      version: 3,
      tracks: { a: res('S') },
      plays: 2,
      counters: { spells: { slow: 4, heart: 'x' }, tracksPlayed: 2, maxCombo: 150 },
      daily: { date: '2026-09-05', done: true, streak: 2, total: 5 },
      goalsClaimed: ['pass-5', 42, null],
    };
    const out = migrate(v3);
    expect(out.counters).toEqual({ spells: { slow: 4, heart: 0 }, tracksPlayed: 2, maxCombo: 150, maxTrackStars: 0 });
    expect(out.daily).toEqual({ date: '2026-09-05', done: true, streak: 2, total: 5 });
    expect(out.goalsClaimed).toEqual(['pass-5']);
    expect(migrate({ version: 99 }).version).toBe(3);
  });

  it('emptySave() returns unshared nested objects', () => {
    const a = emptySave();
    const b = emptySave();
    a.counters.spells.slow = 5;
    expect(b.counters.spells.slow).toBe(0);
    expect(EMPTY_SAVE.counters.spells.slow).toBe(0);
  });

  it('awards stars by rank', () => {
    expect(starsForTrack(undefined)).toBe(0);
    expect(starsForTrack(res('D'))).toBe(0);
    expect(starsForTrack(res('C'))).toBe(1);
    expect(starsForTrack(res('A'))).toBe(2);
    expect(starsForTrack(res('SS'))).toBe(3);
  });

  it('merges results keeping the best score and rank', () => {
    let save = emptySave();
    let r = mergeResult(save, 't', res('B', 500));
    expect(r.newRecord).toBe(true);
    save = r.save;
    r = mergeResult(save, 't', res('A', 400));
    expect(r.newRecord).toBe(false);
    expect(r.save.tracks.t.score).toBe(500);
    expect(r.save.tracks.t.rank).toBe('A');
    expect(r.save.plays).toBe(2);
    expect(totalStars(r.save)).toBe(2);
  });

  it('accumulates spell and run counters without mutating the previous save', () => {
    const s0 = emptySave();
    const s1 = addSpell(addSpell(addSpell(s0, 'slow'), 'heart'), 'slow');
    expect(s1.counters.spells).toEqual({ slow: 2, heart: 1 });
    expect(s0.counters.spells).toEqual({ slow: 0, heart: 0 });
    const s2 = addRun(addRun(s1, { maxCombo: 80, trackStars: 5 }), { maxCombo: 30, trackStars: 7 });
    expect(s2.counters.tracksPlayed).toBe(2);
    expect(s2.counters.maxCombo).toBe(80);
    expect(s2.counters.maxTrackStars).toBe(7);
    expect(s1.counters.tracksPlayed).toBe(0);
  });
});

describe('local tracks (dev-only) and totals', () => {
  it('totalStars skips registered local ids unless the ids are given explicitly', () => {
    registerLocalTrackIds(['my-local']);
    try {
      const save = { ...emptySave(), tracks: { a: res('S'), 'my-local': res('SS') } };
      expect(countedTrackIds(save)).toEqual(['a']);
      expect(totalStars(save)).toBe(3);
      expect(totalStars(save, ['a', 'my-local'])).toBe(6);
      expect(totalStars(save, ['my-local'])).toBe(3);
    } finally {
      resetLocalTrackIds();
    }
    expect(countedTrackIds({ ...emptySave(), tracks: { 'my-local': res('SS') } })).toEqual(['my-local']);
  });
});
