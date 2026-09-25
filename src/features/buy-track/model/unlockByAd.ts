import type { AdOutcome, RewardedAd } from '@/shared/lib/ads';
import type { DropState } from '@/entities/track';

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
 * The rewarded-ad path of the shop — the week's new track only (placement `'weekly-track'`): show
 * the ad, and only on `'rewarded'` persist the unlock — exactly like a purchase for zero crystals,
 * so the track lands in `purchased[]` for good. A close before the end or a provider failure grants
 * nothing; an ad that ends after midnight on Monday still grants the track. The rule «a weekly track,
 * in its first 14 days» is checked here too, not only in the shop's sheet: without `drop.adEligible`
 * nothing is shown and nothing is granted (`failed`).
 */
export async function watchAdForTrack(trackId: string, deps: WatchAdDeps, drop?: Pick<DropState, 'adEligible'>): Promise<WatchAdResult> {
  if (drop?.adEligible !== true) return { outcome: 'failed', unlocked: false };
  const outcome = await deps.ads.show('weekly-track');
  const unlocked = outcome === 'rewarded' && deps.unlock(trackId);
  return { outcome, unlocked };
}
