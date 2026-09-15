import { describe, expect, it } from 'vitest';
import { createArtCache, imageLoader } from './artCache';

describe('artCache', () => {
  it('probes each id once and remembers the answer', async () => {
    const calls: string[] = [];
    const cache = createArtCache(
      async (url) => {
        calls.push(url);
        return url.includes('fox');
      },
      (id) => `/avatars/${id}.webp`,
    );
    expect(cache.state('fox')).toBe('unknown');
    const [a, b] = await Promise.all([cache.probe('fox'), cache.probe('fox')]);
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(cache.state('fox')).toBe('present');
    expect(await cache.probe('cat')).toBe(false);
    expect(cache.state('cat')).toBe('missing');
    await cache.probe('fox');
    await cache.probe('cat');
    expect(calls).toEqual(['/avatars/fox.webp', '/avatars/cat.webp']);
  });

  it('treats a throwing loader as a missing file', async () => {
    const cache = createArtCache(async () => {
      throw new Error('network');
    });
    expect(await cache.probe('owl')).toBe(false);
    expect(cache.state('owl')).toBe('missing');
  });

  it('notifies subscribers when a probe settles, and stops after unsubscribe', async () => {
    const cache = createArtCache(async () => true);
    let ticks = 0;
    const off = cache.subscribe(() => ticks++);
    await cache.probe('dino');
    expect(ticks).toBe(1);
    await cache.probe('dino');
    expect(ticks).toBe(1);
    off();
    await cache.probe('ghost');
    expect(ticks).toBe(1);
  });

  it('the browser loader says "missing" where there is no Image (tests, SSR)', async () => {
    expect(await imageLoader('/avatars/cat.webp')).toBe(false);
  });
});
