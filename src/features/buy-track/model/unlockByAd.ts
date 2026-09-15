import type { AdOutcome, RewardedAd } from '@/shared/lib/ads';

export interface WatchAdDeps {
  ads: Pick<RewardedAd, 'show'>;
  /** Persist the unlock; returns false when the track was owned already. */
  unlock: (trackId: string) => boolean;
}

export interface WatchAdResult {
  outcome: AdOutcome;
  /** The track was unlocked by this ad (false when closed early, failed, or owned before). */
  unlocked: boolean;
}

/**
 * The rewarded-ad path of the shop: show the ad, and only on `'rewarded'` persist the unlock —
 * exactly like a purchase for zero crystals, so the track lands in `purchased[]`. A close before
 * the end or a provider failure grants nothing.
 */
export async function watchAdForTrack(trackId: string, deps: WatchAdDeps): Promise<WatchAdResult> {
  const outcome = await deps.ads.show('shop-track');
  const unlocked = outcome === 'rewarded' && deps.unlock(trackId);
  return { outcome, unlocked };
}
