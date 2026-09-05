import { isGenreFilter, isSortMode, type GenreFilter, type SortMode } from './reel';

export const SORT_KEY = 'neon-tap:menu-sort';
export const GENRE_KEY = 'neon-tap:menu-genre';

/** The two `localStorage` methods we touch — injectable so the logic is testable without a DOM. */
export interface KeyStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface MenuPrefs {
  sort: SortMode;
  genre: GenreFilter;
}

export const DEFAULT_PREFS: MenuPrefs = { sort: 'stars', genre: null };

/** Read the reel preferences; anything unknown or unreadable falls back to the defaults. */
export function readPrefs(store: KeyStore | null | undefined): MenuPrefs {
  if (!store) return DEFAULT_PREFS;
  try {
    const sort = store.getItem(SORT_KEY);
    const genre = store.getItem(GENRE_KEY);
    return {
      sort: isSortMode(sort) ? sort : DEFAULT_PREFS.sort,
      genre: isGenreFilter(genre) ? genre : null,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Persist the reel preferences; a genre of `null` is stored as an empty string. Never throws. */
export function writePrefs(store: KeyStore | null | undefined, prefs: MenuPrefs): void {
  if (!store) return;
  try {
    store.setItem(SORT_KEY, prefs.sort);
    store.setItem(GENRE_KEY, prefs.genre ?? '');
  } catch {
    /* storage unavailable (private mode, quota) — the choice just does not survive a reload */
  }
}
