import { CATALOG, type TrackMeta } from '@/entities/track';
import { lockFor, type CatalogState, type LockState } from './useCatalogState';
import { readDeckCard, readLastTrack } from './deckPosition';
import { cardIndexOf, isTrackCard, trackIndexOf } from './deckCards';
import { unseenDrop } from './dropSeen';

type Read = Pick<Storage, 'getItem'> | null;

const trackIds = (): string[] => CATALOG.map((t) => t.id);

/** The card to open with: the first playable track without a result, else the daily one, else the first. */
export function startIndex(state: CatalogState): number {
  const next = CATALOG.findIndex((t) => !state.save.tracks[t.id] && lockFor(state, t.id, t.stars).locked === false);
  if (next >= 0) return next;
  const daily = CATALOG.findIndex((t) => t.id === state.dailyId);
  return daily >= 0 ? daily : 0;
}

/**
 * Where the deck opens: once per week on the new weekly track (the deck then shows «Новый трек
 * недели!»), else the card it was left on — «Моя музыка» and the empty-week card included, so coming
 * back from the shop or the profile never lands on another track — else `startIndex`.
 */
export function initialDeckIndex(state: CatalogState, storage: Read): number {
  const fresh = unseenDrop(CATALOG, state, storage);
  if (fresh) return CATALOG.indexOf(fresh);
  const card = readDeckCard(storage, trackIds());
  return (card && cardIndexOf(card)) ?? startIndex(state);
}

/**
 * The track the menu stands for when the deck opens on `card`: that card's track, or — on a card
 * without one («Моя музыка», the empty-week card) — the last track the player chose, else `startIndex`.
 */
export function initialTrackIndex(state: CatalogState, storage: Read, card: number): number {
  if (isTrackCard(card)) return card;
  const last = readLastTrack(storage, trackIds());
  const at = last === null ? -1 : CATALOG.findIndex((t) => t.id === last);
  return at >= 0 ? at : startIndex(state);
}

/** A catalog track and its lock — what the page's primary button and the records show (`index` is clamped into the catalog). */
export function focusedTrack(state: CatalogState, index: number): { track: TrackMeta; lock: LockState } {
  const track = CATALOG[trackIndexOf(index)];
  return { track, lock: lockFor(state, track.id, track.stars) };
}
