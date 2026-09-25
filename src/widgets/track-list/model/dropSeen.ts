import type { TrackMeta } from '@/entities/track';
import type { CatalogState } from './useCatalogState';

/** The last weekly track the deck was opened on with the «Новый трек недели!» toast: a per-viewer convenience. */
export const DROP_SEEN_KEY = 'neon-tap:drop-seen';

/** This week's drop in the deck (released less than seven days ago), or null. */
export function thisWeekDrop(catalog: readonly TrackMeta[], state: Pick<CatalogState, 'drops'>): TrackMeta | null {
  return catalog.find((t) => t.drop === true && state.drops.get(t.id)?.thisWeek === true) ?? null;
}

/** This week's drop when the toast has not been shown for it on this device, else null. */
export function unseenDrop(catalog: readonly TrackMeta[], state: Pick<CatalogState, 'drops'>, storage: Pick<Storage, 'getItem'> | null): TrackMeta | null {
  const drop = thisWeekDrop(catalog, state);
  // Without storage the toast could not be remembered: none rather than one on every load.
  if (!drop || !storage) return null;
  try {
    return storage.getItem(DROP_SEEN_KEY) === drop.id ? null : drop;
  } catch {
    return null;
  }
}

/** The toast was shown for `id`: the deck opens as usual from now on. */
export function markDropSeen(storage: Pick<Storage, 'setItem'> | null, id: string): void {
  try {
    storage?.setItem(DROP_SEEN_KEY, id);
  } catch {
    /* private mode / quota — at worst the toast shows once more */
  }
}
