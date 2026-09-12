import { describe, expect, it } from 'vitest';
import { EMPTY_SAVE, addRun, addSpell, emptySave, mergeResult, migrate, starsForTrack, totalStars, type BestResult } from './SaveData';

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
    expect(out.version).toBe(5);
    expect(out.tracks.a.rank).toBe('A');
    expect(out.tracks.b.rank).toBe('D');
    expect(out.plays).toBe(3);
    expect(migrate(null)).toEqual(EMPTY_SAVE);
    expect(migrate('nope')).toEqual(EMPTY_SAVE);
  });

  it('migrates v2 to v3 with back-filled counters, empty daily state and no claimed goals', () => {
    const v2 = { version: 2, tracks: { a: res('A', 900, 120), b: res('D', 50, 40), c: res('C', 300, 77) }, plays: 9 };
    const out = migrate(v2);
    expect(out.version).toBe(5);
    expect(out.tracks).toEqual(v2.tracks);
    expect(out.plays).toBe(9);
    // derived from the stored bests: best combo ever, passes (rank ≥ C)
    expect(out.counters).toEqual({ spells: { slow: 0, heart: 0 }, tracksPlayed: 2, maxCombo: 120, maxTrackStars: 0, genres: [], perfects: 0, customPlays: 0 });
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
    expect(out.counters).toEqual({ spells: { slow: 4, heart: 0 }, tracksPlayed: 2, maxCombo: 150, maxTrackStars: 0, genres: [], perfects: 0, customPlays: 0 });
    expect(out.daily).toEqual({ date: '2026-09-05', done: true, streak: 2, total: 5 });
    expect(out.goalsClaimed).toEqual(['pass-5']);
    expect(migrate({ version: 99 }).version).toBe(5);
  });

  it('migrates v3 through v4 to v5: empty wallet, zeroed achievement counters, everything else kept', () => {
    const v3 = {
      version: 3,
      tracks: { a: res('S') },
      plays: 2,
      counters: { spells: { slow: 4, heart: 1 }, tracksPlayed: 2, maxCombo: 150, maxTrackStars: 5 },
      daily: { date: '2026-09-05', done: true, streak: 2, total: 5 },
      goalsClaimed: ['pass-5'],
    };
    const out = migrate(v3);
    expect(out.version).toBe(5);
    expect(out).toMatchObject({ ...v3, version: 5, counters: { ...v3.counters, genres: [], perfects: 0, customPlays: 0 }, crystals: 0, lifetimeCrystals: 0, purchased: [] });
    // v2 walks through both steps
    const fromV2 = migrate({ version: 2, tracks: {}, plays: 0 });
    expect(fromV2).toMatchObject({ version: 5, crystals: 0, lifetimeCrystals: 0, purchased: [] });
    // v4 with the new counters already present keeps them (unique genres, numbers sanitised)
    const v4 = { version: 4, tracks: {}, plays: 0, counters: { spells: {}, genres: ['rock', 'rock', 3], perfects: '9', customPlays: 2 }, daily: {}, goalsClaimed: [], crystals: 5, lifetimeCrystals: 5, purchased: [] };
    expect(migrate(v4).counters).toMatchObject({ genres: ['rock'], perfects: 0, customPlays: 2 });
  });

  it('sanitises the wallet: no negative / fractional balance, lifetime ≥ balance, unique string ids', () => {
    const out = migrate({ ...emptySave(), crystals: 12.7, lifetimeCrystals: 3, purchased: ['a', 5, 'a', null, 'b'] });
    expect(out.crystals).toBe(12);
    expect(out.lifetimeCrystals).toBe(12);
    expect(out.purchased).toEqual(['a', 'b']);
    expect(migrate({ ...emptySave(), crystals: -5, purchased: 'x' })).toMatchObject({ crystals: 0, lifetimeCrystals: 0, purchased: [] });
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
