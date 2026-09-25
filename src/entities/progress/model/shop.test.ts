import { describe, expect, it } from 'vitest';
import { emptySave } from './SaveData';
import {
  PREMIUM_MULTIPLIER,
  PRICE_BASE,
  PRICE_PER_STAR,
  addCrystals,
  canAfford,
  creditPaidCrystals,
  isForSale,
  isPurchased,
  purchaseTrack,
  trackPrice,
} from './shop';
import { unlockStates } from './unlocks';

describe('shop', () => {
  it('lists premium, bought and star-locked tracks; tracks open by stars alone are not for sale', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `t${i}`);
    // t3 is premium, so the road is t0–t2, t4… : t4 and t5 are free, t6 needs 2 (open), t7 needs 4 and up are locked
    const stars = 3;
    const states = unlockStates(ids, { stars, premium: ['t3'], purchased: ['t9'] });
    expect(states.map((s) => isForSale(s, stars))).toEqual([false, false, false, true, false, false, false, true, true, true, true, true]);
    // the daily track being open for the day does not hide it from the shop
    const daily = unlockStates(ids, { stars, dailyId: 't8' });
    expect(daily[8].unlocked).toBe(true);
    expect(isForSale(daily[8], stars)).toBe(true);
    // everything open by stars and nothing premium or bought → an empty shop
    const rich = unlockStates(ids, { stars: 999 });
    expect(rich.some((s) => isForSale(s, 999))).toBe(false);
  });

  it('prices a track by its stars, premium ×2.5, always a whole number', () => {
    expect(PREMIUM_MULTIPLIER).toBe(2.5);
    expect(trackPrice(0)).toBe(PRICE_BASE);
    expect(trackPrice(4)).toBe(100);
    expect(trackPrice(7)).toBe(145);
    // the premium shelf (★3, ★5, ★6): 213 / 288 / 325
    expect(trackPrice(3, true)).toBe(213);
    expect(trackPrice(5, true)).toBe(288);
    expect(trackPrice(6, true)).toBe(325);
    expect(trackPrice(4, true)).toBe(250);
    expect(trackPrice(5, true)).toBe(Math.round((PRICE_BASE + 5 * PRICE_PER_STAR) * PREMIUM_MULTIPLIER));
    for (let s = 1; s <= 10; s++) {
      expect(Number.isInteger(trackPrice(s, true))).toBe(true);
      expect(trackPrice(s, true)).toBeGreaterThan(trackPrice(s));
      expect(trackPrice(s)).toBeGreaterThan(trackPrice(s - 1));
    }
    expect(trackPrice(-3)).toBe(PRICE_BASE);
    expect(trackPrice(Number.NaN)).toBe(PRICE_BASE);
  });

  it('credits crystals to balance and lifetime, ignoring non-positive amounts', () => {
    const s0 = emptySave();
    const s1 = addCrystals(s0, 7);
    expect(s1).toMatchObject({ crystals: 7, lifetimeCrystals: 7 });
    expect(s0.crystals).toBe(0);
    expect(addCrystals(s1, 0)).toBe(s1);
    expect(addCrystals(s1, -3)).toBe(s1);
    // fractions are floored
    expect(addCrystals(s1, 2.9)).toMatchObject({ crystals: 9, lifetimeCrystals: 9 });
  });

  it('purchase deducts the price once and refuses when owned or short', () => {
    const rich = addCrystals(emptySave(), 120);
    expect(canAfford(rich, 100)).toBe(true);
    expect(canAfford(rich, 121)).toBe(false);

    const poor = purchaseTrack(rich, 't1', 150);
    expect(poor.ok).toBe(false);
    expect(poor.reason).toBe('poor');
    expect(poor.save).toBe(rich);

    const bought = purchaseTrack(rich, 't1', 100);
    expect(bought.ok).toBe(true);
    expect(bought.save.crystals).toBe(20);
    expect(bought.save.lifetimeCrystals).toBe(120);
    expect(bought.save.purchased).toEqual(['t1']);
    expect(isPurchased(bought.save, 't1')).toBe(true);
    expect(isPurchased(rich, 't1')).toBe(false);

    const again = purchaseTrack(bought.save, 't1', 100);
    expect(again.ok).toBe(false);
    expect(again.reason).toBe('owned');
    expect(again.save).toBe(bought.save);

    // Exact balance is enough; a free track costs nothing.
    expect(purchaseTrack(bought.save, 't2', 20).save.crystals).toBe(0);
    expect(purchaseTrack(emptySave(), 't3', 0).ok).toBe(true);
  });

  it('counts purchases for crystals in counters.bought; a free unlock (an ad, NEON PASS) does not', () => {
    const rich = addCrystals(emptySave(), 500);
    const paid = purchaseTrack(rich, 't1', 100).save;
    expect(paid.counters.bought).toBe(1);
    const free = purchaseTrack(paid, 'drop', 0).save;
    expect(free.purchased).toEqual(['t1', 'drop']);
    expect(free.counters.bought).toBe(1);
    // a refused purchase counts nothing
    expect(purchaseTrack(free, 't1', 100).save.counters.bought).toBe(1);
    expect(rich.counters.bought).toBe(0);
  });

  it('bought crystals raise the balance only, never the lifetime total', () => {
    const s0 = addCrystals(emptySave(), 40);
    const s1 = creditPaidCrystals(s0, 700);
    expect(s1).toMatchObject({ crystals: 740, lifetimeCrystals: 40 });
    expect(creditPaidCrystals(s1, 0)).toBe(s1);
    expect(creditPaidCrystals(s1, -5)).toBe(s1);
  });
});
