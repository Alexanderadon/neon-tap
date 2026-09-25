import { describe, expect, it, vi } from 'vitest';
import { NBSP } from '@/shared/lib/format';
import { STUB_PROCESSING_MS, STUB_PRICES_RUB, StubStore, iapOffFlag, iapStubFlag, rubles, type StoreClock } from './stubStore';
import { SKUS, isSku } from './types';

function fakeClock() {
  let now = 0;
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let seq = 0;
  const clock: StoreClock = {
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

describe('StubStore', () => {
  it('sells only in development or with ?iap=stub; ?iap=off always wins', () => {
    // a production build without the flag: no fake store on the live site
    expect(new StubStore({ dev: false, stub: () => false, off: () => false }).available()).toBe(false);
    expect(new StubStore({ dev: true, stub: () => false, off: () => false }).available()).toBe(true);
    expect(new StubStore({ dev: false, stub: () => true, off: () => false }).available()).toBe(true);
    expect(new StubStore({ dev: true, stub: () => true, off: () => true }).available()).toBe(false);
  });

  it('refuses every purchase when it is not available (production without the flag)', async () => {
    const live = new StubStore({ dev: false, stub: () => false, off: () => false });
    await expect(live.buy('crystals-m')).resolves.toBe('failed');
    expect(live.processing).toBeNull();
  });

  it('knows the ?iap=stub and ?iap=off flags (none in tests)', () => {
    expect(iapStubFlag()).toBe(false);
    expect(iapOffFlag()).toBe(false);
  });

  it('prices every sku as rubles with a no-break space: 49 · 99 · 249 · 499', () => {
    const s = new StubStore({ off: () => false, dev: true });
    for (const sku of SKUS) {
      expect(s.price(sku)).toBe(`${STUB_PRICES_RUB[sku]}${NBSP}₽`);
    }
    expect(rubles(249)).toBe(`249${NBSP}₽`);
    expect(SKUS.map((sku) => STUB_PRICES_RUB[sku])).toEqual([49, 99, 249, 499]);
  });

  it('resolves ok after the processing delay and reports the processing sku meanwhile', async () => {
    const c = fakeClock();
    const s = new StubStore({ clock: c.clock, off: () => false, dev: true });
    const listener = vi.fn();
    s.subscribe(listener);
    const done = s.buy('crystals-m');
    expect(s.processing).toBe('crystals-m');
    expect(listener).toHaveBeenCalledTimes(1);
    c.advance(STUB_PROCESSING_MS - 1);
    expect(s.processing).toBe('crystals-m');
    c.advance(1);
    await expect(done).resolves.toBe('ok');
    expect(s.processing).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('cancel() resolves cancel without waiting', async () => {
    const c = fakeClock();
    const s = new StubStore({ clock: c.clock, off: () => false, dev: true });
    const done = s.buy('crystals-xl');
    c.advance(200);
    s.cancel();
    await expect(done).resolves.toBe('cancel');
    c.advance(10_000);
    expect(s.processing).toBeNull();
  });

  it('fails a second purchase while one is processing, and any purchase when unavailable', async () => {
    const c = fakeClock();
    const s = new StubStore({ clock: c.clock, off: () => false, dev: true });
    const first = s.buy('crystals-s');
    await expect(s.buy('crystals-l')).resolves.toBe('failed');
    c.advance(STUB_PROCESSING_MS);
    await expect(first).resolves.toBe('ok');
    const off = new StubStore({ clock: c.clock, off: () => true, dev: true });
    await expect(off.buy('crystals-s')).resolves.toBe('failed');
  });

  it('isSku guards unknown ids', () => {
    expect(isSku('crystals-s')).toBe(true);
    expect(isSku('gold-1')).toBe(false);
    expect(isSku(1)).toBe(false);
  });
});
