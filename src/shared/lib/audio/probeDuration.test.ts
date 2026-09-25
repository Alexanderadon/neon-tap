import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeDuration, type ProbeElement } from './probeDuration';

/** A media element that answers the way the test says once a source is set. */
function fakeElement(answer: { duration?: number; error?: boolean; never?: boolean }) {
  const released: string[] = [];
  const el: ProbeElement & { released: string[] } = {
    preload: '',
    duration: Number.NaN,
    onloadedmetadata: null,
    onerror: null,
    released,
    get src() {
      return '';
    },
    set src(_url: string) {
      if (answer.never) return;
      queueMicrotask(() => {
        if (answer.error) el.onerror?.();
        else {
          Object.defineProperty(el, 'duration', { value: answer.duration ?? Number.NaN });
          el.onloadedmetadata?.();
        }
      });
    },
    removeAttribute: (name: string) => released.push(name),
    load: () => released.push('load'),
  };
  return el;
}

const file = new Blob([new Uint8Array(16)], { type: 'audio/mpeg' });

describe('probeDuration', () => {
  afterEach(() => vi.useRealTimers());

  it('reads the duration from the metadata and lets the file go', async () => {
    const el = fakeElement({ duration: 2400 });
    await expect(probeDuration(file, { make: () => el })).resolves.toBe(2400);
    expect(el.preload).toBe('metadata');
    expect(el.released).toEqual(['src', 'load']);
  });

  it('cannot tell on an error, an unknown or infinite duration', async () => {
    await expect(probeDuration(file, { make: () => fakeElement({ error: true }) })).resolves.toBeNull();
    await expect(probeDuration(file, { make: () => fakeElement({ duration: Number.NaN }) })).resolves.toBeNull();
    await expect(probeDuration(file, { make: () => fakeElement({ duration: Number.POSITIVE_INFINITY }) })).resolves.toBeNull();
    await expect(probeDuration(file, { make: () => fakeElement({ duration: 0 }) })).resolves.toBeNull();
  });

  it('gives up after the timeout when the browser never answers', async () => {
    vi.useFakeTimers();
    const el = fakeElement({ never: true });
    const probe = probeDuration(file, { make: () => el, timeoutMs: 1000 });
    vi.advanceTimersByTime(1000);
    await expect(probe).resolves.toBeNull();
    expect(el.released).toEqual(['src', 'load']);
  });

  it('cannot tell without a media element (tests, workers)', async () => {
    await expect(probeDuration(file)).resolves.toBeNull();
  });
});
