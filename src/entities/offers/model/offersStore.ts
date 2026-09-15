import { createStore, useStore } from '@/shared/lib/store/createStore';

/** What the offers remember between launches (localStorage `neon-tap:offers`). */
export interface OffersState {
  /** First launch (ms since the epoch) — the 48-hour windows count from here; null until the first menu. */
  anchor: number | null;
  /** When the music pack popup was last shown, or null. */
  musicShownAt: number | null;
  /** The music pack was bought (the popup never returns). */
  musicBought: boolean;
}

export const KEY = 'neon-tap:offers';

export const EMPTY_OFFERS: OffersState = { anchor: null, musicShownAt: null, musicBought: false };

const stamp = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

/** A stored blob (or garbage) → a valid state. */
export function sanitizeOffers(raw: unknown): OffersState {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_OFFERS };
  const o = raw as Record<string, unknown>;
  return { anchor: stamp(o.anchor), musicShownAt: stamp(o.musicShownAt), musicBought: o.musicBought === true };
}

function load(): OffersState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitizeOffers(JSON.parse(raw)) : { ...EMPTY_OFFERS };
  } catch {
    return { ...EMPTY_OFFERS };
  }
}

export const offersStore = createStore<OffersState>(typeof localStorage === 'undefined' ? { ...EMPTY_OFFERS } : load());

offersStore.subscribe(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(offersStore.get()));
  } catch {
    /* storage unavailable */
  }
});

/** Pin the first launch once; returns the anchor. */
export function ensureOffersAnchor(now: number = Date.now()): number {
  const cur = offersStore.get().anchor;
  if (cur !== null) return cur;
  offersStore.set({ anchor: now });
  return now;
}

export function markMusicOfferShown(now: number = Date.now()): void {
  offersStore.set({ musicShownAt: now });
}

export function markMusicPackBought(): void {
  if (!offersStore.get().musicBought) offersStore.set({ musicBought: true });
}

export function resetOffers(): void {
  offersStore.set({ ...EMPTY_OFFERS });
}

export function useOffers<R>(selector: (s: OffersState) => R): R {
  return useStore(offersStore, selector);
}

// --- per-session memory (never persisted): the 48-hour popup pops once per app session ---
let limitedShown = false;

export function limitedShownThisSession(): boolean {
  return limitedShown;
}

export function markLimitedShownThisSession(): void {
  limitedShown = true;
}

/** Tests only. */
export function resetSessionMemory(): void {
  limitedShown = false;
}
