import { songKey, type SongMeta } from '@/entities/custom-song';

/** «Недавние» (last played, else added) · «А–Я» · «Сложность» (easy first). */
export type SongSort = 'recent' | 'az' | 'level';
export const SONG_SORTS: readonly SongSort[] = ['recent', 'az', 'level'];

/** Russian alphabetical order, numbers by value («Трек 2» before «Трек 10»), case and ё / е alike. */
const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });

/** The song matches the search: the query (lower case, ё → е) inside the title or the artist. */
export function matchesQuery(song: SongMeta, query: string): boolean {
  const key = songKey(query);
  if (!key) return true;
  return song.titleKey.includes(key) || songKey(song.artist).includes(key);
}

const recentAt = (s: SongMeta) => s.lastPlayedAt ?? s.createdAt;
const byTitle = (a: SongMeta, b: SongMeta) => collator.compare(a.title, b.title);

const ORDER: Record<SongSort, (a: SongMeta, b: SongMeta) => number> = {
  recent: (a, b) => recentAt(b) - recentAt(a) || byTitle(a, b),
  az: (a, b) => byTitle(a, b) || a.createdAt - b.createdAt,
  level: (a, b) => a.stars - b.stars || byTitle(a, b),
};

/** The songs the list shows: filtered by the query, then sorted (a new array; the input is untouched). */
export function visibleSongs(songs: readonly SongMeta[], query: string, sort: SongSort): SongMeta[] {
  return songs.filter((s) => matchesQuery(s, query)).sort(ORDER[sort]);
}
