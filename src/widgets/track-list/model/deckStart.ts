import { CATALOG, type TrackMeta } from '@/entities/track';
import { lockFor, type CatalogState, type LockState } from './useCatalogState';
import { readDeckIndex } from './deckPosition';
import { trackIndexOf } from './deckCards';

/** The card to open with: the first playable track without a result, else the daily one, else the first. */
export function startIndex(state: CatalogState): number {
  const next = CATALOG.findIndex((t) => !state.save.tracks[t.id] && lockFor(state, t.id, t.stars).locked === false);
  if (next >= 0) return next;
  const daily = CATALOG.findIndex((t) => t.id === state.dailyId);
  return daily >= 0 ? daily : 0;
}

/** Where the deck opens: the remembered track, else `startIndex` — never the custom card (a track is what the player came back for). */
export function initialDeckIndex(state: CatalogState, storage: Pick<Storage, 'getItem'> | null): number {
  return readDeckIndex(storage, CATALOG.length) ?? startIndex(state);
}

/** The focused track and its lock — what the page's primary button shows (the custom card falls back to the last track). */
export function focusedTrack(state: CatalogState, index: number): { track: TrackMeta; lock: LockState } {
  const track = CATALOG[trackIndexOf(index)];
  return { track, lock: lockFor(state, track.id, track.stars) };
}
