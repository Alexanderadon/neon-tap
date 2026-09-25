import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryRepo, removeSong, setSongRepo, songsStore, type SongRepo } from '@/entities/custom-song';
import { testSong } from '@/entities/custom-song/model/testSongs';
import { checkAdd, checkAddNow, saveSong, songLimit } from './quota';

const roomy = async () => 1e10;
const opts = (pass = false) => ({ pass, freeBytes: roomy, persist: async () => true });

let repo: SongRepo;
beforeEach(async () => {
  repo = memoryRepo();
  await setSongRepo(repo);
});

describe('checkAdd', () => {
  it('ok while a slot is free, limit at three, duplicate for a saved id even when full', () => {
    expect(checkAdd('custom:d', [], false)).toBe('ok');
    expect(checkAdd('custom:d', ['custom:a', 'custom:b'], false)).toBe('ok');
    expect(checkAdd('custom:d', ['custom:a', 'custom:b', 'custom:c'], false)).toBe('limit');
    expect(checkAdd('custom:b', ['custom:a', 'custom:b', 'custom:c'], false)).toBe('duplicate');
  });

  it('NEON PASS has no limit', () => {
    const many = Array.from({ length: 40 }, (_, i) => `custom:${i}`);
    expect(checkAdd('custom:new', many, true)).toBe('ok');
    expect(songLimit(true)).toBeNull();
    expect(songLimit(false)).toBe(3);
  });

  it('checks against the storage, not the list in memory', async () => {
    await repo.add(testSong('custom:a'), null);
    await repo.add(testSong('custom:b'), null);
    await repo.add(testSong('custom:c'), null); // another tab: the store in memory has not seen these
    expect(songsStore.get().songs).toHaveLength(0);
    expect(await checkAddNow('custom:d', false)).toBe('limit');
    expect(await checkAddNow('custom:a', false)).toBe('duplicate');
    expect(await checkAddNow('custom:d', true)).toBe('ok');
  });
});

describe('saveSong', () => {
  it('saves up to three, then refuses; deleting a song frees its slot', async () => {
    for (const id of ['custom:a', 'custom:b', 'custom:c']) expect(await saveSong(testSong(id), opts())).toBe('saved');
    expect(await saveSong(testSong('custom:d'), opts())).toBe('limit');
    expect(await saveSong(testSong('custom:a'), opts())).toBe('duplicate');
    await removeSong('custom:b');
    expect(await saveSong(testSong('custom:d'), opts())).toBe('saved');
    expect(songsStore.get().songs.map((s) => s.id)).toEqual(['custom:a', 'custom:c', 'custom:d']);
  });

  it('with PASS saves past three', async () => {
    for (let i = 0; i < 5; i++) expect(await saveSong(testSong(`custom:${i}`), opts(true))).toBe('saved');
    expect(await repo.count()).toBe(5);
  });

  it('two saves racing for the last slot (two tabs): one is saved, the other hits the limit', async () => {
    await saveSong(testSong('custom:a'), opts());
    await saveSong(testSong('custom:b'), opts());
    const outcomes = await Promise.all([saveSong(testSong('custom:x'), opts()), saveSong(testSong('custom:y'), opts())]);
    expect(outcomes.sort()).toEqual(['limit', 'saved']);
    expect(await repo.count()).toBe(3);
  });

  it('too little free space by the estimate: not written, played once', async () => {
    expect(await saveSong(testSong('custom:a', { bytes: 1000 }), { pass: false, freeBytes: async () => 1000 })).toBe('no-room');
    expect(await repo.count()).toBe(0);
  });

  it('QuotaExceededError on the write: not written', async () => {
    await setSongRepo(memoryRepo([], { maxBytes: 50 }));
    expect(await saveSong(testSong('custom:a', { bytes: 100 }), { pass: false, freeBytes: async () => null })).toBe('no-room');
    expect(songsStore.get().songs).toHaveLength(0);
  });

  it('no IndexedDB: unavailable', async () => {
    await setSongRepo(null);
    expect(await saveSong(testSong('custom:a'), opts())).toBe('unavailable');
    expect(await checkAddNow('custom:a', false)).toBe('ok');
  });

  it('asks the browser to keep the storage after the first save only', async () => {
    vi.resetModules();
    const entity = await import('@/entities/custom-song');
    const quota = await import('./quota');
    await entity.setSongRepo(entity.memoryRepo());
    const persist = vi.fn(async () => true);
    await quota.saveSong(testSong('custom:a'), { pass: false, freeBytes: roomy, persist });
    await quota.saveSong(testSong('custom:b'), { pass: false, freeBytes: roomy, persist });
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
