/**
 * Rewarded ads (GDD «Реклама за награду»): the week's new track (its first 14 days) and the second
 * chance for a player without NEON PASS — the two `AdPlacement`s. No network is wired yet: in
 * development (and with `?ads=fast`, 3 s) `ads` is the stub that resolves `'rewarded'` after
 * AD_SECONDS; on the live site it is `NoAds` — `available()` is false, no ad button shows and the
 * second chance is offered only with NEON PASS. When a real network is picked, implement
 * `RewardedAd` next to `StubAds` and choose it in `pickAds`.
 */
import { StubAds, adsFastFlag } from './stubAds';
import { pickAds } from './noAds';
import type { RewardedAd } from './types';

export type { AdOutcome, AdPlacement, RewardedAd } from './types';
export type { AdClock } from './stubAds';
export type { AdsEnv } from './noAds';
export type { StubAdView } from './useStubAd';
export { StubAds, AD_SECONDS, AD_SECONDS_FAST, adsFastFlag } from './stubAds';
export { NoAds, pickAds } from './noAds';
export { useStubAdProgress } from './useStubAd';

/**
 * The stub instance — its frames (the shop's `AdScreen`, the second chance's waiting button) follow
 * it with `useStubAdProgress(stubAds)` and close it with `cancel()`, and only when `isStubAds`.
 */
export const stubAds = new StubAds();
/** The one provider the app talks to. */
export const ads: RewardedAd = pickAds({ dev: import.meta.env.DEV, fast: adsFastFlag() }, stubAds);
/** This build plays the stub (development or `?ads=fast`): the game draws the ad's frame itself. A real network shows its own player. */
export const isStubAds: boolean = ads === stubAds;
