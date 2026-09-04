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
  it('migrates unversioned blobs and rejects garbage', () => {
    expect(migrate(null)).toEqual(EMPTY_SAVE);
    expect(migrate({ tracks: { a: { easy: res('A') } } })).toEqual({ version: 1, tracks: { a: { easy: res('A') } }, plays: 0 });
    expect(migrate('nope')).toEqual(EMPTY_SAVE);
  });

  it('awards stars by best rank over difficulties', () => {
    expect(starsForTrack(undefined)).toBe(0);
    expect(starsForTrack({ easy: res('D') })).toBe(0);
    expect(starsForTrack({ easy: res('C') })).toBe(1);
    expect(starsForTrack({ easy: res('B'), hard: res('A') })).toBe(2);
    expect(starsForTrack({ normal: res('SS') })).toBe(3);
  });

  it('merges results keeping the best score and rank', () => {
    let save = { ...EMPTY_SAVE, tracks: {} };
    let r = mergeResult(save, 't', 'easy', res('B', 500));
    expect(r.newRecord).toBe(true);
    save = r.save;
    r = mergeResult(save, 't', 'easy', res('A', 400));
    expect(r.newRecord).toBe(false);
    expect(r.save.tracks.t.easy?.score).toBe(500);
    expect(r.save.tracks.t.easy?.rank).toBe('A');
    expect(r.save.plays).toBe(2);
    expect(totalStars(r.save)).toBe(2);
  });
});
