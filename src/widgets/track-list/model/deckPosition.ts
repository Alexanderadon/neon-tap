/** Where the deck was left: a per-viewer convenience in localStorage (never authoritative). */
const KEY = 'neon-tap:deck';

export function readDeckIndex(storage: Pick<Storage, 'getItem'> | null, count: number): number | null {
  try {
    const raw = storage?.getItem(KEY);
    if (raw === null || raw === undefined) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 && n < count ? n : null;
  } catch {
    return null;
  }
}

export function writeDeckIndex(storage: Pick<Storage, 'setItem'> | null, index: number): void {
  try {
    storage?.setItem(KEY, String(index));
  } catch {
    /* private mode / quota — the deck simply opens on the default card next time */
  }
}
