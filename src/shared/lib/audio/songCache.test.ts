import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Each `loadUrl` call: its URL, its abort signal and the handle to finish it. */
const calls: { url: string; signal?: AbortSignal; resolve: (b: AudioBuffer) => void }[] = [];

vi.mock('./AudioEngine', () => ({
  audioEngine: {
    loadUrl: (url: string, opts: { signal?: AbortSignal } = {}) =>
      new Promise<AudioBuffer>((resolve, reject) => {
        calls.push({ url, signal: opts.signal, resolve });
        opts.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
  },
}));

const { cancelBackgroundLoad, loadSong } = await import('./songCache');
const buffer = (duration: number) => ({ duration }) as AudioBuffer;

describe('song cache: cancelling a background load', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('aborts a background load of that song, and the next load starts afresh', async () => {
    const radio = loadSong('/music/a.mp3', { background: true });
    cancelBackgroundLoad('/music/a.mp3');
    await expect(radio).rejects.toThrow();
    expect(calls[0].signal?.aborted).toBe(true);
    const again = loadSong('/music/a.mp3', { background: true });
    expect(calls).toHaveLength(2);
    calls[1].resolve(buffer(10));
    await expect(again).resolves.toEqual(buffer(10));
  });

  it('keeps a load someone now waits for in the foreground (the game took over the radio song)', async () => {
    const radio = loadSong('/music/b.mp3', { background: true });
    const game = loadSong('/music/b.mp3');
    cancelBackgroundLoad('/music/b.mp3');
    expect(calls[0].signal?.aborted).toBe(false);
    calls[0].resolve(buffer(20));
    await expect(game).resolves.toEqual(buffer(20));
    await expect(radio).resolves.toEqual(buffer(20));
  });

  it('is a no-op for a song not loading (finished or never asked for)', async () => {
    expect(() => cancelBackgroundLoad('/music/none.mp3')).not.toThrow();
    const done = loadSong('/music/c.mp3', { background: true });
    calls[0].resolve(buffer(30));
    await done;
    cancelBackgroundLoad('/music/c.mp3');
    await expect(loadSong('/music/c.mp3')).resolves.toEqual(buffer(30));
    expect(calls).toHaveLength(1);
  });
});
