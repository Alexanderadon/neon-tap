import { describe, expect, it } from 'vitest';
import { EMPTY_SAVE, mergeResult, migrate, starsForTrack, totalStars, type BestResult } from './SaveData';

const res = (rank: BestResult['rank'], score = 1000): BestResult => ({
  score,
  accuracy: 0.9,
  rank,
  maxCombo: 10,
  fullCombo: false,
  playedAt: '2026-01-01',
});

describe('SaveData', () => {
  it('migrates v1 (three charts per track) to v2 keeping the best result', () => {
    const v1 = { version: 1, tracks: { a: { easy: res('B', 900), hard: res('A', 500) }, b: { normal: res('D', 50) } }, plays: 3 };
    const out = migrate(v1);
    expect(out.version).toBe(2);
    expect(out.tracks.a.rank).toBe('A');
    expect(out.tracks.b.rank).toBe('D');
    expect(out.plays).toBe(3);
    expect(migrate(null)).toEqual(EMPTY_SAVE);
    expect(migrate('nope')).toEqual(EMPTY_SAVE);
  });

  it('awards stars by rank', () => {
    expect(starsForTrack(undefined)).toBe(0);
    expect(starsForTrack(res('D'))).toBe(0);
    expect(starsForTrack(res('C'))).toBe(1);
    expect(starsForTrack(res('A'))).toBe(2);
    expect(starsForTrack(res('SS'))).toBe(3);
  });

  it('merges results keeping the best score and rank', () => {
    let save = { ...EMPTY_SAVE, tracks: {} };
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
});
