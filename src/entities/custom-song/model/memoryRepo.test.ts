import { describe, expect, it } from 'vitest';
import { memoryRepo } from './memoryRepo';
import { testSong } from './testSongs';

describe('memoryRepo', () => {
  it('adds, lists, reads the chart and the audio, removes', async () => {
    const repo = memoryRepo();
    const song = testSong('custom:a', { title: 'A' });
    expect(await repo.add(song, 3)).toBe('ok');
    expect((await repo.list()).map((s) => s.id)).toEqual(['custom:a']);
    expect(await repo.count()).toBe(1);
    expect((await repo.chart('custom:a'))?.title).toBe('A');
    expect(await repo.audio('custom:a')).toBe(song.audio);
    await repo.remove('custom:a');
    expect(await repo.count()).toBe(0);
    expect(await repo.chart('custom:a')).toBeUndefined();
  });

  it('refuses a duplicate even at the limit, and a new song at the limit', async () => {
    const repo = memoryRepo([testSong('custom:a'), testSong('custom:b'), testSong('custom:c')]);
    expect(await repo.add(testSong('custom:a'), 3)).toBe('duplicate');
    expect(await repo.add(testSong('custom:d'), 3)).toBe('limit');
    expect(await repo.add(testSong('custom:d'), null)).toBe('ok');
  });

  it('two adds racing for the last slot: exactly one wins', async () => {
    const repo = memoryRepo([testSong('custom:a'), testSong('custom:b')]);
    const outcomes = await Promise.all([repo.add(testSong('custom:x'), 3), repo.add(testSong('custom:y'), 3)]);
    expect(outcomes.sort()).toEqual(['limit', 'ok']);
    expect(await repo.count()).toBe(3);
  });

  it('updates only songs that still exist and copies values in and out', async () => {
    const repo = memoryRepo([testSong('custom:a')]);
    const updated = await repo.update('custom:a', { lastPlayedAt: 42 });
    expect(updated?.lastPlayedAt).toBe(42);
    updated!.title = 'mutated';
    expect((await repo.get('custom:a'))?.title).toBe('custom:a');
    expect(await repo.update('custom:gone', { lastPlayedAt: 1 })).toBeUndefined();
    expect(await repo.count()).toBe(1);
  });

  it('throws QuotaExceededError when the disk is full, and keeps nothing', async () => {
    const repo = memoryRepo([], { maxBytes: 100 });
    expect(await repo.add(testSong('custom:a', { bytes: 60 }), null)).toBe('ok');
    await expect(repo.add(testSong('custom:b', { bytes: 60 }), null)).rejects.toMatchObject({ name: 'QuotaExceededError' });
    expect(await repo.count()).toBe(1);
  });
});
