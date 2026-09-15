/**
 * Rewarded ads (GDD «Реклама за награду»). The provider is not chosen yet: `ads` is the stub that
 * resolves `'rewarded'` after AD_SECONDS (3 s with `?ads=fast`). When a real network is picked,
 * implement `RewardedAd` next to `StubAds` and swap the instance below — nothing else changes.
 */
import { StubAds } from './stubAds';
import type { RewardedAd } from './types';

export type { AdOutcome, AdPlacement, RewardedAd } from './types';
export type { AdClock } from './stubAds';
export { StubAds, AD_SECONDS, AD_SECONDS_FAST, adsFastFlag } from './stubAds';

/** The stub instance — UI that needs the countdown reads `stubAds.progress()` / `subscribe()` while it lasts. */
export const stubAds = new StubAds();
/** The one provider the app talks to. */
export const ads: RewardedAd = stubAds;
