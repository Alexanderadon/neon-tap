import { afterEach, describe, expect, it } from 'vitest';
import { isLocalTrackId, resetLocalTrackIds } from '@/shared/lib/local-tracks';
import { CATALOG, findTrack } from './catalog';
import { isLocalTrack, localCatalogStore, mergeCatalogs, parseLocalCatalog, setLocalCatalog } from './localCatalog';
import type { TrackMeta } from './types';

const meta = (id: string, over: Partial<TrackMeta> = {}): TrackMeta => ({
  id,
  title: id,
  artist: '',
  license: 'private',
  sourceUrl: '',
  genre: 'local',
  bpm: 120,
  duration: 90,
  stars: 5,
  notes: 100,
  features: { circles: 0, rolls: 0, slides: 0, holds: 0, laneChanges: 0 },
  ...over,
});

describe('mergeCatalogs', () => {
  it('appends local tracks after the built-in ones, flagged local', () => {
    const builtIn = [meta('a', { genre: 'rock' }), meta('b', { genre: 'jazz' })];
    const merged = mergeCatalogs(builtIn, [meta('x'), meta('y')]);
    expect(merged.map((t) => t.id)).toEqual(['a', 'b', 'x', 'y']);
    expect(merged[0]).toEqual(builtIn[0]);
    expect(merged[0].local).toBeUndefined();
    expect(merged[2]).toMatchObject({ id: 'x', local: true, genre: 'local' });
    expect(merged[3].local).toBe(true);
  });

  it('drops a local id that collides with a built-in one and dedupes locals', () => {
    const builtIn = [meta('a', { genre: 'rock' })];
    const merged = mergeCatalogs(builtIn, [meta('a', { title: 'shadow' }), meta('x'), meta('x')]);
    expect(merged.map((t) => t.id)).toEqual(['a', 'x']);
    expect(merged[0].title).toBe('a');
    expect(merged[0].genre).toBe('rock');
  });

  it('leaves the inputs untouched', () => {
    const builtIn = [meta('a')];
    const local = [meta('x', { genre: 'techno' })];
    mergeCatalogs(builtIn, local);
    expect(builtIn).toHaveLength(1);
    expect(local[0].genre).toBe('techno');
    expect(local[0].local).toBeUndefined();
  });
});

describe('parseLocalCatalog', () => {
  it('returns [] for anything that is not an array', () => {
    expect(parseLocalCatalog(undefined)).toEqual([]);
    expect(parseLocalCatalog(null)).toEqual([]);
    expect(parseLocalCatalog('<!doctype html>')).toEqual([]);
    expect(parseLocalCatalog({ id: 'x' })).toEqual([]);
  });

  it('keeps well-formed entries, forces the local genre/flag and fills defaults', () => {
    const raw = [
      { id: 'x', title: 'X', artist: 'A', bpm: 128.4, duration: 120.5, stars: 6, notes: 200, features: { circles: 1, rolls: 2, slides: 3, holds: 4, laneChanges: 5 }, genre: 'rock' },
      { id: 'y' },
      { id: 'x', title: 'dup' },
      { title: 'no id' },
      42,
      null,
    ];
    const out = parseLocalCatalog(raw);
    expect(out.map((t) => t.id)).toEqual(['x', 'y']);
    expect(out[0]).toEqual({
      id: 'x',
      title: 'X',
      artist: 'A',
      license: 'private',
      sourceUrl: '',
      genre: 'local',
      bpm: 128.4,
      duration: 120.5,
      stars: 6,
      notes: 200,
      features: { circles: 1, rolls: 2, slides: 3, holds: 4, laneChanges: 5 },
      local: true,
    });
    expect(out[1]).toMatchObject({ id: 'y', title: 'y', artist: '', stars: 1, bpm: 0, features: { circles: 0, holds: 0 }, local: true });
  });

  it('clamps stars into 1..10', () => {
    expect(parseLocalCatalog([{ id: 'a', stars: 0 }])[0].stars).toBe(1);
    expect(parseLocalCatalog([{ id: 'a', stars: 99 }])[0].stars).toBe(10);
    expect(parseLocalCatalog([{ id: 'a', stars: 'x' }])[0].stars).toBe(1);
  });
});

describe('local catalog store', () => {
  afterEach(() => {
    setLocalCatalog([]);
    resetLocalTrackIds();
  });

  it('starts empty and not loaded', () => {
    expect(localCatalogStore.get().tracks).toEqual([]);
    expect(isLocalTrack('x')).toBe(false);
  });

  it('publishes the list, flags it and registers ids for the progress rules', () => {
    setLocalCatalog([meta('x', { genre: 'rock' })]);
    expect(localCatalogStore.get().loaded).toBe(true);
    expect(localCatalogStore.get().tracks[0]).toMatchObject({ id: 'x', local: true, genre: 'local' });
    expect(isLocalTrack('x')).toBe(true);
    expect(isLocalTrackId('x')).toBe(true);
    expect(isLocalTrackId(CATALOG[0].id)).toBe(false);
  });

  it('findTrack falls back to local tracks, built-in ids win', () => {
    setLocalCatalog([meta('x'), meta(CATALOG[0].id, { title: 'shadow' })]);
    expect(findTrack('x')?.local).toBe(true);
    expect(findTrack(CATALOG[0].id)).toBe(CATALOG[0]);
    expect(findTrack('nope')).toBeUndefined();
  });
});
