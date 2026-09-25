import { describe, expect, it } from 'vitest';
import { STUB_PRICES_RUB } from '@/shared/lib/iap';
import { CRYSTAL_PACKS, crystalPack, crystalsFor, realBonusPercent } from './catalogue';
import { LEGACY_OFFERS_KEY, resetOffers } from './legacy';

const rub = (sku: keyof typeof STUB_PRICES_RUB) => STUB_PRICES_RUB[sku];

describe('crystal packs', () => {
  it('are 300 · 700 · 2 000 · 4 500 for 49 · 99 · 249 · 499 ₽, labelled +15 / +30 / +45 %', () => {
    expect(CRYSTAL_PACKS.map((p) => p.sku)).toEqual(['crystals-s', 'crystals-m', 'crystals-l', 'crystals-xl']);
    expect(CRYSTAL_PACKS.map((p) => p.crystals)).toEqual([300, 700, 2000, 4500]);
    expect(CRYSTAL_PACKS.map((p) => rub(p.sku))).toEqual([49, 99, 249, 499]);
    expect(CRYSTAL_PACKS.map((p) => p.bonusPercent)).toEqual([0, 15, 30, 45]);
  });

  it('never label a bonus above the real one, and the bonus grows with the pack', () => {
    for (const pack of CRYSTAL_PACKS) expect(pack.bonusPercent).toBeLessThanOrEqual(realBonusPercent(pack, rub));
    expect(realBonusPercent(CRYSTAL_PACKS[0], rub)).toBe(0);
    for (let i = 1; i < CRYSTAL_PACKS.length; i++) {
      expect(CRYSTAL_PACKS[i].bonusPercent).toBeGreaterThan(CRYSTAL_PACKS[i - 1].bonusPercent);
      expect(realBonusPercent(CRYSTAL_PACKS[i], rub)).toBeGreaterThan(realBonusPercent(CRYSTAL_PACKS[i - 1], rub));
    }
  });

  it('look packs up by sku', () => {
    expect(crystalPack('crystals-l')?.crystals).toBe(2000);
    expect(crystalsFor('crystals-xl')).toBe(4500);
    expect(crystalsFor('crystals-s')).toBe(300);
  });
});

describe('removed offers', () => {
  it('reset clears the stale schedule key an older version left', () => {
    const store = new Map<string, string>([[LEGACY_OFFERS_KEY, '{"anchor":1}']]);
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { removeItem: (k: string) => store.delete(k) },
    });
    try {
      resetOffers();
      expect(store.has(LEGACY_OFFERS_KEY)).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original });
    }
    // no storage at all: nothing throws
    expect(() => resetOffers()).not.toThrow();
  });
});
