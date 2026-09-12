import { GENRES, type Genre } from '@/shared/types/chart';

/** Minimal slice of a catalog entry the reel needs to filter and order. */
export interface ReelTrack {
  id: string;
  title: string;
  genre: Genre;
  stars: number;
}

/** Reel order: catalog order (easiest first) · alphabetical · unplayed songs first. */
export type SortMode = 'stars' | 'title' | 'new';
export const SORT_MODES: readonly SortMode[] = ['stars', 'title', 'new'];

/** `null` = every genre. */
export type GenreFilter = Genre | null;

export function isSortMode(v: unknown): v is SortMode {
  return typeof v === 'string' && (SORT_MODES as readonly string[]).includes(v);
}

export function isGenreFilter(v: unknown): v is Genre {
  return typeof v === 'string' && (GENRES as readonly string[]).includes(v);
}

/** Genres present in the catalog, in the canonical `GENRES` order (not first-seen order). */
export function genresOf<T extends { genre: Genre }>(tracks: readonly T[]): Genre[] {
  const seen = new Set<Genre>();
  for (const t of tracks) seen.add(t.genre);
  return GENRES.filter((g) => seen.has(g));
}

export interface ArrangeOptions {
  genre?: GenreFilter;
  sort?: SortMode;
  /** Has the player finished this track at least once? Used by the `new` order. */
  played?: (id: string) => boolean;
}

/**
 * Filter + order for the reel. Pure and stable: two tracks that compare equal keep their catalog
 * order, so `stars` (the catalog is already easiest-first) is simply the input order.
 */
export function arrangeTracks<T extends ReelTrack>(tracks: readonly T[], opts: ArrangeOptions = {}): T[] {
  const { genre = null, sort = 'stars', played = () => false } = opts;
  const list = genre ? tracks.filter((t) => t.genre === genre) : tracks.slice();
  if (sort === 'title') {
    return list.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  }
  if (sort === 'new') {
    // Unplayed first; inside each group the catalog order stays (Array.prototype.sort is stable).
    return list.sort((a, b) => Number(played(a.id)) - Number(played(b.id)));
  }
  return list;
}

/** Accent colour of a difficulty: cyan → lime → orange → magenta as the stars grow. */
export function toneFor(stars: number): string {
  if (stars <= 3) return '#00f0ff';
  if (stars <= 5) return '#b6ff00';
  if (stars <= 7) return '#ff8a00';
  return '#ff2bd6';
}

/** Position of `id` in `list`, or -1. */
export function indexOfTrack(list: readonly { id: string }[], id: string): number {
  return list.findIndex((t) => t.id === id);
}

/** Neighbour index for arrow-key navigation inside the reel; clamps at both ends. */
export function stepIndex(index: number, delta: number, length: number): number {
  if (length <= 0) return -1;
  const from = index < 0 ? 0 : index;
  return Math.max(0, Math.min(length - 1, from + delta));
}
