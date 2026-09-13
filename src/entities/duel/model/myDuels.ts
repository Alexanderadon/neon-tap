export const MY_DUELS_KEY = 'neon-tap:duels';
const KEEP = 20;

/** A duel this device hosted: enough to fetch it and to name it in a list. */
export interface MyDuel {
  id: string;
  track: string;
  /** ISO date of the host run. */
  at: string;
}

function storageOf(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Duels hosted from this device, newest first. */
export function myDuels(storage: Storage | null = storageOf()): MyDuel[] {
  try {
    const raw = storage?.getItem(MY_DUELS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((d): d is MyDuel => !!d && typeof d.id === 'string' && typeof d.track === 'string') : [];
  } catch {
    return [];
  }
}

/** Add a hosted duel to the list (newest first, no duplicates, the last KEEP). */
export function rememberDuel(duel: MyDuel, storage: Storage | null = storageOf()): void {
  const list = [duel, ...myDuels(storage).filter((d) => d.id !== duel.id)].slice(0, KEEP);
  try {
    storage?.setItem(MY_DUELS_KEY, JSON.stringify(list));
  } catch {
    /* storage may be unavailable (private mode) */
  }
}
