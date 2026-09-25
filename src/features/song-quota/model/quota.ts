import { freeStorageBytes, isQuotaError, persistStorage } from '@/shared/lib/idb';
import { addSong, savedSongIds, songLimit, songStorageAvailable, type NewSong } from '@/entities/custom-song';
import { isPassActive } from '@/entities/pass';

/** May a song with this id be added: yes, it is saved already (open it), or every free slot is taken. */
export type AddCheck = 'ok' | 'duplicate' | 'limit';

/** How saving ended. `no-room` and `unavailable` play the song once without keeping it. */
export type SaveOutcome = 'saved' | 'duplicate' | 'limit' | 'no-room' | 'unavailable';

/** The slot rule lives with the songs (`entities/custom-song`); re-exported for the feature's callers. */
export { songLimit };

/** The decision before decoding: a saved id opens that song (even when the slots are full); a new one needs a free slot. */
export function checkAdd(id: string, savedIds: readonly string[], pass: boolean): AddCheck {
  if (savedIds.includes(id)) return 'duplicate';
  const limit = songLimit(pass);
  return limit !== null && savedIds.length >= limit ? 'limit' : 'ok';
}

/** The same against the storage right now (another tab may have added a song). Without storage every song is `ok` — it plays once. */
export async function checkAddNow(id: string, pass: boolean = isPassActive()): Promise<AddCheck> {
  if (!songStorageAvailable()) return 'ok';
  try {
    return checkAdd(id, await savedSongIds(), pass);
  } catch {
    return 'ok';
  }
}

/** Free space kept on top of the file itself before a write is tried. */
export const ROOM_MARGIN_BYTES = 5 * 1024 * 1024;

interface SaveOptions {
  pass?: boolean;
  /** Free bytes of the origin (`navigator.storage.estimate()`); injectable for tests. */
  freeBytes?: () => Promise<number | null>;
  /** `navigator.storage.persist()`; injectable for tests. */
  persist?: () => Promise<boolean>;
}

let persistAsked = false;

/**
 * Save a generated song. The slot count and the write happen in one transaction (`addSong`), so
 * two tabs cannot pass the limit together. Too little free space (by the estimate, or a
 * `QuotaExceededError` on the write) → `no-room`; no IndexedDB → `unavailable`. After the first
 * save the browser is asked to keep the storage (`persist`).
 */
export async function saveSong(song: NewSong, opts: SaveOptions = {}): Promise<SaveOutcome> {
  if (!songStorageAvailable()) return 'unavailable';
  const free = await (opts.freeBytes ?? freeStorageBytes)();
  if (free !== null && free < song.audio.size + ROOM_MARGIN_BYTES) return 'no-room';
  let outcome;
  try {
    outcome = await addSong(song, songLimit(opts.pass ?? isPassActive()));
  } catch (err) {
    if (isQuotaError(err)) return 'no-room';
    console.warn('songs: not saved', err);
    return 'unavailable';
  }
  if (outcome !== 'ok') return outcome;
  if (!persistAsked) {
    persistAsked = true;
    void (opts.persist ?? persistStorage)();
  }
  return 'saved';
}
