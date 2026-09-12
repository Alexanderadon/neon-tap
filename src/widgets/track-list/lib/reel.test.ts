import { describe, expect, it } from 'vitest';
import { GENRES } from '@/shared/types/chart';
import { arrangeTracks, genresOf, indexOfTrack, isGenreFilter, isSortMode, stepIndex, toneFor, type ReelTrack } from './reel';

const T: ReelTrack[] = [
  { id: 'a', title: 'Zeta Pulse', genre: 'techno', stars: 4 },
  { id: 'b', title: 'alpha wave', genre: 'synthwave', stars: 4 },
  { id: 'c', title: 'Menace', genre: 'techno', stars: 5 },
  { id: 'd', title: 'Beta', genre: 'lofi', stars: 6 },
];

describe('reel · genresOf', () => {
  it('lists only present genres in canonical GENRES order', () => {
    expect(genresOf(T)).toEqual(['synthwave', 'lofi', 'techno']);
    expect(genresOf([])).toEqual([]);
  });

  it('never invents a genre that is not in the catalog', () => {
    const out = genresOf(T);
    expect(out.every((g) => GENRES.includes(g))).toBe(true);
    expect(out).not.toContain('rock');
  });
});

describe('reel · arrangeTracks', () => {
  it('keeps catalog order for the default (stars) sort and copies the array', () => {
    const out = arrangeTracks(T);
    expect(out.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(out).not.toBe(T);
  });

  it('filters by genre', () => {
    expect(arrangeTracks(T, { genre: 'techno' }).map((t) => t.id)).toEqual(['a', 'c']);
    expect(arrangeTracks(T, { genre: 'rock' })).toEqual([]);
    expect(arrangeTracks(T, { genre: null }).length).toBe(4);
  });

  it('sorts by title case-insensitively', () => {
    expect(arrangeTracks(T, { sort: 'title' }).map((t) => t.id)).toEqual(['b', 'd', 'c', 'a']);
  });

  it('puts unplayed tracks first and keeps catalog order inside each group', () => {
    const played = (id: string) => id === 'a' || id === 'c';
    expect(arrangeTracks(T, { sort: 'new', played }).map((t) => t.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('combines filter and sort', () => {
    const played = (id: string) => id === 'a';
    expect(arrangeTracks(T, { genre: 'techno', sort: 'new', played }).map((t) => t.id)).toEqual(['c', 'a']);
  });

  it('does not mutate the input', () => {
    const copy = T.slice();
    arrangeTracks(T, { sort: 'title' });
    expect(T).toEqual(copy);
  });
});

describe('reel · guards', () => {
  it('validates sort modes and genre filters read back from storage', () => {
    expect(isSortMode('title')).toBe(true);
    expect(isSortMode('stars')).toBe(true);
    expect(isSortMode('new')).toBe(true);
    expect(isSortMode('random')).toBe(false);
    expect(isSortMode(null)).toBe(false);
    expect(isGenreFilter('techno')).toBe(true);
    expect(isGenreFilter('all')).toBe(false);
    expect(isGenreFilter(undefined)).toBe(false);
  });
});

describe('reel · helpers', () => {
  it('maps difficulty to the neon palette', () => {
    expect(toneFor(1)).toBe('#00f0ff');
    expect(toneFor(3)).toBe('#00f0ff');
    expect(toneFor(4)).toBe('#b6ff00');
    expect(toneFor(7)).toBe('#ff8a00');
    expect(toneFor(10)).toBe('#ff2bd6');
  });

  it('finds a track by id', () => {
    expect(indexOfTrack(T, 'c')).toBe(2);
    expect(indexOfTrack(T, 'zzz')).toBe(-1);
  });

  it('steps through the reel and clamps at both ends', () => {
    expect(stepIndex(0, -1, 4)).toBe(0);
    expect(stepIndex(3, 1, 4)).toBe(3);
    expect(stepIndex(1, 1, 4)).toBe(2);
    expect(stepIndex(-1, 1, 4)).toBe(1);
    expect(stepIndex(0, 1, 0)).toBe(-1);
  });
});
