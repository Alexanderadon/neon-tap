import { describe, expect, it, vi } from 'vitest';
import { NBSP } from '@/shared/lib/format';
import { STUB_PROCESSING_MS, STUB_PRICES_RUB, StubStore, rubles, type StoreClock } from './stubStore';
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
  it('is available unless the off flag is set', () => {
    expect(new StubStore({ off: () => false }).available()).toBe(true);
    expect(new StubStore({ off: () => true }).available()).toBe(false);
  });

  it('prices every sku as rubles with a no-break space; the deal costs as much as the middle pack', () => {
    const s = new StubStore({ off: () => false });
    for (const sku of SKUS) {
      expect(s.price(sku)).toBe(`${STUB_PRICES_RUB[sku]}${NBSP}₽`);
    }
    expect(rubles(249)).toBe(`249${NBSP}₽`);
    expect(STUB_PRICES_RUB['limited-48h']).toBe(STUB_PRICES_RUB['crystals-m']);
  });

  it('resolves ok after the processing delay and reports the processing sku meanwhile', async () => {
    const c = fakeClock();
    const s = new StubStore({ clock: c.clock, off: () => false });
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
    const s = new StubStore({ clock: c.clock, off: () => false });
    const done = s.buy('music-8');
    c.advance(200);
    s.cancel();
    await expect(done).resolves.toBe('cancel');
    c.advance(10_000);
    expect(s.processing).toBeNull();
  });

  it('fails a second purchase while one is processing, and any purchase when unavailable', async () => {
    const c = fakeClock();
    const s = new StubStore({ clock: c.clock, off: () => false });
    const first = s.buy('crystals-s');
    await expect(s.buy('crystals-l')).resolves.toBe('failed');
    c.advance(STUB_PROCESSING_MS);
    await expect(first).resolves.toBe('ok');
    const off = new StubStore({ clock: c.clock, off: () => true });
    await expect(off.buy('crystals-s')).resolves.toBe('failed');
  });

  it('isSku guards unknown ids', () => {
    expect(isSku('crystals-s')).toBe(true);
    expect(isSku('gold-1')).toBe(false);
    expect(isSku(1)).toBe(false);
  });
});
