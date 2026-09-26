import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryRepo } from './memoryRepo';
import { testSong } from './testSongs';
import {
  SONGS_COUNT_KEY,
  addSong,
  findSong,
  loadSongData,
  removeSong,
  renameSong,
  replaceSongChart,
  saveBest,
  setSongRepo,
  songStorageAvailable,
  songsStore,
  touchPlayed,
  whenSongsLoaded,
} from './songsStore';
import type { SongBest, SongRepo } from './types';

const best = (score: number): SongBest => ({
  score,
  accuracy: 0.9,
  rank: 'A',
  maxCombo: 10,
  fullCombo: false,
  stars: 2,
  crowns: 0,
  playedAt: '2026-09-25T00:00:00.000Z',
});

function fakeLocalStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
  });
  return data;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('songsStore', () => {
  it('without IndexedDB (node) the storage is unavailable', async () => {
    await setSongRepo(null);
    expect(songsStore.get().status).toBe('unavailable');
    expect(songStorageAvailable()).toBe(false);
  });

  it('loads the meta list from the repo, oldest first', async () => {
    await setSongRepo(memoryRepo([testSong('custom:b', { createdAt: 2 }), testSong('custom:a', { createdAt: 1 })]));
    const s = await whenSongsLoaded();
    expect(s.status).toBe('ready');
    expect(s.songs.map((x) => x.id)).toEqual(['custom:a', 'custom:b']);
    expect(findSong('custom:b')?.createdAt).toBe(2);
  });

  it('adds, renames and removes through the repo', async () => {
    const repo = memoryRepo();
    await setSongRepo(repo);
    expect(await addSong(testSong('custom:a'), 3)).toBe('ok');
    expect(songsStore.get().songs).toHaveLength(1);
    expect(await renameSong('custom:a', '  Ёлка ')).toBe(true);
    expect(findSong('custom:a')).toMatchObject({ title: 'Ёлка', titleKey: 'елка' });
    expect((await repo.get('custom:a'))?.title).toBe('Ёлка');
    expect(await renameSong('custom:a', '  ')).toBe(false);
    const data = await loadSongData('custom:a');
    expect(data?.chart.title).toBe('Ёлка'); // the stored chart keeps its old name; the current title is applied
    await removeSong('custom:a');
    expect(songsStore.get().songs).toHaveLength(0);
    expect(await loadSongData('custom:a')).toBeNull();
  });

  it('«Сложнее» replaces the chart and the stars of its meta in one step, keeping the title and the record', async () => {
    const repo = memoryRepo([testSong('custom:a', { stars: 2, title: 'Моя' })]);
    await setSongRepo(repo);
    await saveBest('custom:a', best(400));
    const harder = testSong('custom:a', { stars: 3, title: 'old name' }).chart;
    harder.chart.notes = [
      [1, 0],
      [2, 1],
      [3, 2],
    ];
    expect(await replaceSongChart('custom:a', harder, 2)).toBe(true);
    expect(findSong('custom:a')).toMatchObject({ stars: 3, notes: 3, generatorVersion: 2, title: 'Моя' });
    expect(findSong('custom:a')?.best?.score).toBe(400);
    const data = await loadSongData('custom:a');
    expect(data?.chart.chart.stars).toBe(3);
    expect(data?.meta.stars).toBe(3);
    expect(data?.chart.title).toBe('Моя');
    // Deleted meanwhile (another tab): nothing is written and the list forgets it.
    await repo.remove('custom:a');
    expect(await replaceSongChart('custom:a', harder, 2)).toBe(false);
    expect(findSong('custom:a')).toBeUndefined();
    expect(await repo.chart('custom:a')).toBeUndefined();
  });

  it('writes the play time and the record in memory at once and to the repo after', async () => {
    const repo = memoryRepo([testSong('custom:a')]);
    await setSongRepo(repo);
    touchPlayed('custom:a', 777);
    const saved = saveBest('custom:a', best(500));
    expect(findSong('custom:a')).toMatchObject({ lastPlayedAt: 777, best: { score: 500 } });
    expect(await saved).toBe(true);
    expect(await repo.get('custom:a')).toMatchObject({ lastPlayedAt: 777, best: { score: 500 } });
  });

  it('a song deleted in another tab gets no record back', async () => {
    const repo = memoryRepo([testSong('custom:a')]);
    await setSongRepo(repo);
    await repo.remove('custom:a'); // the other tab
    expect(await saveBest('custom:a', best(900))).toBe(false);
    expect(await repo.get('custom:a')).toBeUndefined();
    expect(findSong('custom:a')).toBeUndefined();
  });

  it('keeps the song count in localStorage and notices when the browser wiped the songs', async () => {
    const ls = fakeLocalStorage({ [SONGS_COUNT_KEY]: '2' });
    await setSongRepo(memoryRepo());
    expect(songsStore.get().evicted).toBe(true);
    expect(ls.get(SONGS_COUNT_KEY)).toBe('0');
    await addSong(testSong('custom:a'), 3);
    expect(songsStore.get().evicted).toBe(false);
    expect(ls.get(SONGS_COUNT_KEY)).toBe('1');
    await setSongRepo(memoryRepo([testSong('custom:a')]));
    expect(songsStore.get().evicted).toBe(false);
  });

  it('gives up on a first load that never answers (a stuck indexedDB.open): songs play once', async () => {
    vi.useFakeTimers();
    try {
      const hanging: SongRepo = { ...memoryRepo(), list: () => new Promise(() => undefined) };
      void setSongRepo(hanging);
      expect(songsStore.get().status).toBe('loading');
      vi.advanceTimersByTime(4000);
      expect(songsStore.get().status).toBe('unavailable');
      expect(songStorageAvailable()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
