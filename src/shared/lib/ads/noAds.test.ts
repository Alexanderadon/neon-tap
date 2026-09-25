import { describe, expect, it } from 'vitest';
import { NoAds, pickAds } from './noAds';
import { StubAds } from './stubAds';

describe('the ad provider of a build', () => {
  it('is unavailable in production without the flag: no button, and show() grants nothing', async () => {
    const ads = pickAds({ dev: false, fast: false }, new StubAds());
    expect(ads).toBeInstanceOf(NoAds);
    expect(ads.available()).toBe(false);
    await expect(ads.show('weekly-track')).resolves.toBe('failed');
  });

  it('is the stub in development or with ?ads=fast', () => {
    const stub = new StubAds();
    expect(pickAds({ dev: true, fast: false }, stub)).toBe(stub);
    expect(pickAds({ dev: false, fast: true }, stub)).toBe(stub);
    expect(stub.available()).toBe(true);
  });
});
