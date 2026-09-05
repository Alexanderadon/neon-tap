import { createStore, useStore } from '@/shared/lib/store/createStore';
import { registerLocalTrackIds } from '@/shared/lib/local-tracks';
import { LOCAL_GENRE } from '@/shared/types/chart';
import type { TrackMeta } from './types';

/**
 * Dev-only local tracks (`public/local/catalog.json`, written by `npm run assets:local`). The file is
 * gitignored and stripped from the production build, so in production this store simply stays empty.
 */
export interface LocalCatalogState {
  tracks: readonly TrackMeta[];
  /** The fetch finished (with a list or with nothing). */
  loaded: boolean;
}

export const localCatalogStore = createStore<LocalCatalogState>({ tracks: [], loaded: false });

/** Replace the local list; every id is also registered with `shared/lib/local-tracks` for the progress rules. */
export function setLocalCatalog(tracks: readonly TrackMeta[]): void {
  const flagged = tracks.map(asLocal);
  registerLocalTrackIds(flagged.map((t) => t.id));
  localCatalogStore.set({ tracks: flagged, loaded: true });
}

export function useLocalCatalog(): readonly TrackMeta[] {
  return useStore(localCatalogStore, (s) => s.tracks);
}

export function isLocalTrack(id: string): boolean {
  return localCatalogStore.get().tracks.some((t) => t.id === id);
}

export function findLocalTrack(id: string): TrackMeta | undefined {
  return localCatalogStore.get().tracks.find((t) => t.id === id);
}

/**
 * Built-in tracks first (their order and unlock positions are untouched), then the local ones flagged
 * `local: true`. A local id that collides with a built-in one is dropped — the built-in track wins.
 */
export function mergeCatalogs(builtIn: readonly TrackMeta[], local: readonly TrackMeta[]): TrackMeta[] {
  const taken = new Set(builtIn.map((t) => t.id));
  const out: TrackMeta[] = [...builtIn];
  for (const t of local) {
    if (taken.has(t.id)) continue;
    taken.add(t.id);
    out.push(asLocal(t));
  }
  return out;
}

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Sanitise the fetched `catalog.json`; anything that is not an array of entries with an id yields `[]`. */
export function parseLocalCatalog(raw: unknown): TrackMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: TrackMeta[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    const id = str(e.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const f = (e.features && typeof e.features === 'object' ? e.features : {}) as Record<string, unknown>;
    out.push({
      id,
      title: str(e.title) || id,
      artist: str(e.artist),
      license: str(e.license) || 'private',
      sourceUrl: str(e.sourceUrl),
      genre: LOCAL_GENRE,
      bpm: num(e.bpm),
      duration: num(e.duration),
      stars: Math.max(1, Math.min(10, Math.round(num(e.stars, 1)))),
      notes: num(e.notes),
      features: { circles: num(f.circles), rolls: num(f.rolls), slides: num(f.slides), holds: num(f.holds), laneChanges: num(f.laneChanges) },
      local: true,
    });
  }
  return out;
}

function asLocal(t: TrackMeta): TrackMeta {
  return t.local && t.genre === LOCAL_GENRE ? t : { ...t, genre: LOCAL_GENRE, local: true };
}
