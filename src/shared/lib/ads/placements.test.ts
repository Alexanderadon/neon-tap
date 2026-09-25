import { describe, expect, it } from 'vitest';
import { AD_PLACEMENTS, type RewardedAd } from './types';
import { NoAds } from './noAds';
import { StubAds } from './stubAds';

describe('rewarded-ad placements', () => {
  it('are the weekly track and the second chance — nothing else shows an ad', () => {
    expect(AD_PLACEMENTS).toEqual(['weekly-track', 'revive']);
  });

  it('the second chance plays through the stub like the weekly track; without a network nothing is granted', async () => {
    await expect(new StubAds({ seconds: () => 0 }).show('revive')).resolves.toBe('rewarded');
    const none: RewardedAd = new NoAds();
    expect(none.available()).toBe(false);
    await expect(none.show('revive')).resolves.toBe('failed');
  });
});
