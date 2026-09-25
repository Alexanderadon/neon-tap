/**
 * Where a rewarded ad is offered. `'weekly-track'` — the week's new track, during its first 14
 * days after release — is the only placement left (docs/plans/economy-drops-mymusic.md §2.2);
 * `'shop-track'` and `'revive'` are the old ones, removed once nothing calls them.
 */
export type AdPlacement = 'weekly-track' | 'shop-track' | 'revive';

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
