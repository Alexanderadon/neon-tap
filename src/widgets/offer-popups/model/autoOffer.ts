import type { OfferKind } from '@/entities/offers';

export interface AutoOfferInput {
  /** `store.available()`. */
  available: boolean;
  /** A first-launch step (name, calibration, tutorial) is still pending — nothing pops over it. */
  firstLaunchPending: boolean;
  /** The 48-hour window is open right now. */
  limitedActive: boolean;
  /** The 48-hour popup was already shown this app session. */
  limitedShown: boolean;
  /** `musicOfferDue(...)`. */
  musicDue: boolean;
}

/**
 * Which popup the menu opens by itself, one at a time: the 48-hour deal first (once per session
 * while it is on), else the music pack when due, else nothing. The regular crystals never pop.
 */
export function pickAutoOffer(i: AutoOfferInput): Exclude<OfferKind, 'crystals'> | null {
  if (!i.available || i.firstLaunchPending) return null;
  if (i.limitedActive && !i.limitedShown) return 'limited';
  if (i.musicDue) return 'music';
  return null;
}
