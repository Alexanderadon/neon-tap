/**
 * Rewarded ads (GDD «Реклама за награду»): only for the week's new track. No network is wired yet:
 * in development (and with `?ads=fast`, 3 s) `ads` is the stub that resolves `'rewarded'` after
 * AD_SECONDS; on the live site it is `NoAds` — `available()` is false and no ad button shows. When a
 * real network is picked, implement `RewardedAd` next to `StubAds` and choose it in `pickAds`.
 */
import { StubAds, adsFastFlag } from './stubAds';
import { pickAds } from './noAds';
import type { RewardedAd } from './types';

export type { AdOutcome, AdPlacement, RewardedAd } from './types';
export type { AdClock } from './stubAds';
export type { AdsEnv } from './noAds';
export { StubAds, AD_SECONDS, AD_SECONDS_FAST, adsFastFlag } from './stubAds';
export { NoAds, pickAds } from './noAds';

/** The stub instance — its own frame (`AdScreen`) reads `stubAds.progress()` / `subscribe()`, and only when `ads === stubAds`. */
export const stubAds = new StubAds();
/** The one provider the app talks to. */
export const ads: RewardedAd = pickAds({ dev: import.meta.env.DEV, fast: adsFastFlag() }, stubAds);
