/**
 * Where a rewarded ad is offered — nowhere else:
 * - `'weekly-track'` — the week's new track, during its first 14 days after release
 *   (docs/plans/economy-drops-mymusic.md §2.2); the shop's other tracks never show an ad;
 * - `'revive'` — the second chance when the hearts run out, once per run, for a player without
 *   NEON PASS (with PASS it is free and shows no ad; it never costs crystals).
 */
export const AD_PLACEMENTS = ['weekly-track', 'revive'] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

/** How a rewarded ad ended: the reward is granted only on `'rewarded'`. */
export type AdOutcome = 'rewarded' | 'closed' | 'failed';

/**
 * Rewarded-ad provider seam. The real network (Yandex, …) is chosen later; until then the
 * development build plays `StubAds` (a timer) and the production build has `NoAds`. Callers only
 * ever see this interface.
 */
export interface RewardedAd {
  /** Whether an ad can be offered right now (SDK loaded, inventory available). */
  available(): boolean;
  /** Show the ad; resolves when it ends. Never rejects — failures come back as `'failed'`. */
  show(placement: AdPlacement): Promise<AdOutcome>;
}
