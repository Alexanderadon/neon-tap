/**
 * Where a rewarded ad is offered. `'weekly-track'` — the week's new track, during its first 14
 * days after release — is the only placement (docs/plans/economy-drops-mymusic.md §2.2): the shop's
 * other tracks and the second chance never show an ad.
 */
export type AdPlacement = 'weekly-track';

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
