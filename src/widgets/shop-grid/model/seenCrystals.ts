/**
 * The balance the shop showed last time — a per-viewer convenience in localStorage (never
 * authoritative). When the player comes back richer, the crystals fly into the wallet chip and
 * the prices that became affordable tick from magenta to cyan (mockup screen 7).
 */
const KEY = 'neon-tap:shop-seen';

export function readSeenCrystals(storage: Pick<Storage, 'getItem'> | null): number | null {
  try {
    const raw = storage?.getItem(KEY);
    if (raw === null || raw === undefined) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

export function writeSeenCrystals(storage: Pick<Storage, 'setItem'> | null, crystals: number): void {
  try {
    storage?.setItem(KEY, String(Math.max(0, Math.floor(crystals))));
  } catch {
    /* private mode / quota — no flight next time, nothing else changes */
  }
}

/** Crystals that arrived since the last visit (0 when nothing came, or the first visit). */
export function arrivedSince(seen: number | null, now: number): number {
  if (seen === null) return 0;
  return Math.max(0, now - seen);
}
