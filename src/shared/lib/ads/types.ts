/** Where a rewarded ad is offered: a track for a view in the shop, or +5 hearts and a resume in the game. */
export type AdPlacement = 'shop-track' | 'revive';

/** How a rewarded ad ended: the reward is granted only on `'rewarded'`. */
export type AdOutcome = 'rewarded' | 'closed' | 'failed';

/**
 * Rewarded-ad provider seam. The real network (Yandex, AdMob, …) is chosen later; until then
 * `StubAds` plays a timer. Callers only ever see this interface.
 */
export interface RewardedAd {
  /** Whether an ad can be offered right now (SDK loaded, inventory available). */
  available(): boolean;
  /** Show the ad; resolves when it ends. Never rejects — failures come back as `'failed'`. */
  show(placement: AdPlacement): Promise<AdOutcome>;
}
