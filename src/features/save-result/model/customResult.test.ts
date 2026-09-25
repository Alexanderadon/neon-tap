import { beforeEach, describe, expect, it } from 'vitest';
import type { PlayResult } from '@/shared/types/result';
import { findSong, memoryRepo, setSongRepo, type SongRepo } from '@/entities/custom-song';
import { testSong } from '@/entities/custom-song/model/testSongs';
import { progressStore, resetProgress } from '@/entities/progress';
import { customResultMeta } from './customResult';

const ID = 'custom:0123456789abcdef0123';
const NOW = Date.UTC(2026, 8, 25, 12, 0, 0);

const run = (over: Partial<PlayResult> = {}): PlayResult => ({
  trackId: ID,
  score: 5000,
  accuracy: 0.92,
  rank: 'A',
  maxCombo: 40,
  totalNotes: 100,
  counts: { perfect: 80, great: 10, good: 5, miss: 5 },
  fullCombo: false,
  notesToS: 3,
  failed: false,
  stars: 2,
  crowns: 0,
  endless: false,
  level: 3,
  hearts: 3,
  timeline: { t: [], j: [], combo: [] },
  duration: 90,
  crystals: 0,
  ...over,
});

let repo: SongRepo;

beforeEach(async () => {
  resetProgress();
  repo = memoryRepo([testSong(ID)]);
  await setSongRepo(repo);
});

describe('customResultMeta', () => {
  it('the first run on a saved song is its record; no road stars; SaveData untouched', async () => {
    const tracksBefore = progressStore.get().tracks;
    const meta = customResultMeta(run(), NOW);
    expect(meta).toEqual({ newRecord: true, starsBefore: 0, starsAfter: 0, bestBefore: null, crownsBefore: 0, crownsAfter: 0 });
    // Read synchronously right away (the result screen), written to the song storage after.
    expect(findSong(ID)?.best).toMatchObject({ score: 5000, stars: 2, playedAt: '2026-09-25T12:00:00.000Z' });
    await new Promise((r) => setTimeout(r, 0));
    expect((await repo.get(ID))?.best?.score).toBe(5000);
    expect(progressStore.get().tracks).toBe(tracksBefore);
    expect(progressStore.get().tracks[ID]).toBeUndefined();
  });

  it('a better score beats the record and tells what it was; a worse one keeps it', () => {
    customResultMeta(run({ score: 5000, crowns: 1 }), NOW);
    expect(customResultMeta(run({ score: 7000 }), NOW + 1)).toMatchObject({ newRecord: true, bestBefore: 5000, crownsBefore: 1, crownsAfter: 1 });
    expect(customResultMeta(run({ score: 100, crowns: 2 }), NOW + 2)).toMatchObject({ newRecord: false, bestBefore: 7000, crownsBefore: 1, crownsAfter: 2 });
    expect(findSong(ID)?.best).toMatchObject({ score: 7000, crowns: 2 });
  });

  it('a song played once without saving has no record', () => {
    expect(customResultMeta(run({ trackId: 'custom:ffffffffffffffffffff' }), NOW)).toEqual({ newRecord: false, starsBefore: 0, starsAfter: 0 });
  });
});
