/** localStorage key of the removed offers' schedule (the 48-hour deal's first launch, the music pack's last showing). */
export const LEGACY_OFFERS_KEY = 'neon-tap:offers';

/**
 * Forget what the removed offers remembered — the progress reset calls it. Nothing is scheduled any
 * more, so this only clears the stale key an older version left behind.
 */
export function resetOffers(): void {
  try {
    localStorage.removeItem(LEGACY_OFFERS_KEY);
  } catch {
    /* storage unavailable */
  }
}
