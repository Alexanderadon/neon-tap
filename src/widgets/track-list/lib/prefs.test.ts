import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, GENRE_KEY, SORT_KEY, readPrefs, writePrefs, type KeyStore } from './prefs';

function memStore(init: Record<string, string> = {}): KeyStore & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe('menu prefs', () => {
  it('falls back to defaults without a store or with garbage', () => {
    expect(readPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(readPrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(readPrefs(memStore({ [SORT_KEY]: 'weird', [GENRE_KEY]: 'polka' }))).toEqual(DEFAULT_PREFS);
  });

  it('round-trips sort and genre', () => {
    const s = memStore();
    writePrefs(s, { sort: 'title', genre: 'techno' });
    expect(readPrefs(s)).toEqual({ sort: 'title', genre: 'techno' });
    writePrefs(s, { sort: 'new', genre: null });
    expect(s.data[GENRE_KEY]).toBe('');
    expect(readPrefs(s)).toEqual({ sort: 'new', genre: null });
  });

  it('swallows storage errors on both paths', () => {
    const broken: KeyStore = {
      getItem: () => {
        throw new Error('nope');
      },
      setItem: () => {
        throw new Error('nope');
      },
    };
    expect(readPrefs(broken)).toEqual(DEFAULT_PREFS);
    expect(() => writePrefs(broken, { sort: 'title', genre: 'lofi' })).not.toThrow();
  });
});
