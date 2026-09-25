import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findSong, memoryRepo, renameSong, setSongRepo } from '@/entities/custom-song';
import { testSong } from '@/entities/custom-song/model/testSongs';
import { sessionStore } from '@/entities/play-session';
import { playCustomSong, playGeneratedSong, releaseSongBuffer } from './playCustom';

const fakeBuffer = (duration: number) => ({ duration }) as unknown as AudioBuffer;

beforeEach(async () => {
  await setSongRepo(memoryRepo([testSong('custom:a', { title: 'Old' })]));
  sessionStore.set({ chart: null, audioBuffer: fakeBuffer(1), source: 'catalog', result: null, resultMeta: null });
});

describe('playCustomSong', () => {
  it('decodes the saved file, starts a custom session with the current title and opens the game', async () => {
    await renameSong('custom:a', 'New');
    const decode = vi.fn(async (data: ArrayBuffer) => {
      expect(sessionStore.get().audioBuffer).toBeNull(); // the previous song was let go first
      expect(data.byteLength).toBe(16);
      return fakeBuffer(90);
    });
    const go = vi.fn();
    expect(await playCustomSong('custom:a', { decode, go })).toBe('ok');
    const s = sessionStore.get();
    expect(s.source).toBe('custom');
    expect(s.chart).toMatchObject({ id: 'custom:a', title: 'New' });
    expect(s.audioBuffer?.duration).toBe(90);
    expect(findSong('custom:a')?.lastPlayedAt).not.toBeNull();
    expect(go).toHaveBeenCalledTimes(1);
  });

  it('a song that is gone: missing, nothing started, the old buffer released', async () => {
    const go = vi.fn();
    expect(await playCustomSong('custom:gone', { decode: async () => fakeBuffer(1), go })).toBe('missing');
    expect(sessionStore.get().audioBuffer).toBeNull();
    expect(go).not.toHaveBeenCalled();
  });

  it('a file that fails to decode: failed', async () => {
    const go = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await playCustomSong('custom:a', { decode: async () => Promise.reject(new Error('bad')), go })).toBe('failed');
    expect(go).not.toHaveBeenCalled();
  });
});

describe('playGeneratedSong / releaseSongBuffer', () => {
  it('plays a fresh buffer, marks a saved song played', () => {
    const go = vi.fn();
    playGeneratedSong(testSong('custom:a').chart, fakeBuffer(90), true, go);
    expect(sessionStore.get()).toMatchObject({ source: 'custom', chart: { id: 'custom:a' } });
    expect(findSong('custom:a')?.lastPlayedAt).not.toBeNull();
    releaseSongBuffer();
    expect(sessionStore.get().audioBuffer).toBeNull();
    expect(go).toHaveBeenCalledTimes(1);
  });
});
