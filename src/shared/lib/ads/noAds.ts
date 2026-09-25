import { StubAds } from './stubAds';
import type { AdOutcome, RewardedAd } from './types';

/** No ad network: nothing is offered, and a stray `show()` grants nothing. The production build until an SDK is wired. */
export class NoAds implements RewardedAd {
  available(): boolean {
    return false;
  }

  show(): Promise<AdOutcome> {
    return Promise.resolve('failed');
  }
}

/** When the stub may play: in development (`vite`) or with the `?ads=fast` review flag. */
export interface AdsEnv {
  dev: boolean;
  fast: boolean;
}

/**
 * The provider for this build: the timer stub only in development or with `?ads=fast` — on the
 * live site without an SDK there is no ad at all (a 30-second timer would hand out every weekly
 * track and every second chance for nothing); without NEON PASS the second chance is then not
 * offered.
 */
export function pickAds(env: AdsEnv, stub: StubAds): RewardedAd {
  return env.dev || env.fast ? stub : new NoAds();
}
