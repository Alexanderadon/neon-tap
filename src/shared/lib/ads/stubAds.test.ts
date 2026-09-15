import { describe, expect, it, vi } from 'vitest';
import { AD_SECONDS, StubAds, type AdClock } from './stubAds';

function fakeClock() {
  let now = 0;
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let seq = 0;
  const clock: AdClock = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = ++seq;
      timers.push({ at: now + ms, fn, id });
      return id;
    },
    clearTimeout: (id) => {
      const i = timers.findIndex((t) => t.id === id);
      if (i >= 0) timers.splice(i, 1);
    },
  };
  return {
    clock,
    advance(ms: number) {
      now += ms;
      for (const t of [...timers].sort((a, b) => a.at - b.at)) {
        if (t.at <= now) {
          timers.splice(timers.indexOf(t), 1);
          t.fn();
        }
      }
    },
  };
}

describe('StubAds', () => {
  it('is always available and idle at start', () => {
    const ads = new StubAds({ clock: fakeClock().clock });
    expect(ads.available()).toBe(true);
    expect(ads.playing).toBe(false);
    expect(ads.progress()).toBe(0);
    expect(ads.remainingSeconds()).toBe(0);
  });

  it('rewards after AD_SECONDS by default and reports progress on the way', async () => {
    const c = fakeClock();
    const ads = new StubAds({ clock: c.clock, seconds: () => AD_SECONDS });
    const done = ads.show('shop-track');
    expect(ads.playing).toBe(true);
    expect(ads.durationSeconds).toBe(AD_SECONDS);
    c.advance(AD_SECONDS * 500);
    expect(ads.progress()).toBeCloseTo(0.5);
    expect(ads.remainingSeconds()).toBeCloseTo(AD_SECONDS / 2);
    c.advance(AD_SECONDS * 500);
    await expect(done).resolves.toBe('rewarded');
    expect(ads.playing).toBe(false);
    expect(ads.progress()).toBe(0);
  });

  it('uses the short duration when asked (the ?ads=fast flag)', async () => {
    const c = fakeClock();
    const ads = new StubAds({ clock: c.clock, seconds: () => 3 });
    const done = ads.show('revive');
    c.advance(2999);
    expect(ads.playing).toBe(true);
    c.advance(1);
    await expect(done).resolves.toBe('rewarded');
  });

  it('cancel() resolves closed without a reward and notifies subscribers', async () => {
    const c = fakeClock();
    const ads = new StubAds({ clock: c.clock, seconds: () => 30 });
    const listener = vi.fn();
    ads.subscribe(listener);
    const done = ads.show('revive');
    expect(listener).toHaveBeenCalledTimes(1);
    c.advance(1000);
    ads.cancel();
    await expect(done).resolves.toBe('closed');
    expect(listener).toHaveBeenCalledTimes(2);
    c.advance(60_000);
    expect(ads.playing).toBe(false);
  });

  it('refuses a second ad while one plays', async () => {
    const c = fakeClock();
    const ads = new StubAds({ clock: c.clock, seconds: () => 30 });
    const first = ads.show('shop-track');
    await expect(ads.show('shop-track')).resolves.toBe('failed');
    c.advance(30_000);
    await expect(first).resolves.toBe('rewarded');
  });
});
