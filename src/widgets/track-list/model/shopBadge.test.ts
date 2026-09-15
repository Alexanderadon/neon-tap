import { describe, expect, it } from 'vitest';
import { CATALOG, PREMIUM_IDS, TRACK_IDS } from '@/entities/track';
import { trackPrice, unlockStates, type SaveData } from '@/entities/progress';
import { affordableCount, forSaleNow, LOCKED_ON_SALE } from './shopBadge';

function state(stars: number, crystals: number, purchased: string[] = []) {
  const list = unlockStates(TRACK_IDS, { stars, premium: PREMIUM_IDS, purchased });
  return { stars, unlocks: new Map(list.map((u) => [u.id, u])), save: { crystals, purchased } as unknown as SaveData };
}

describe('shop badge', () => {
  it('lists premium tracks and at most the next locked ones, never what is owned', () => {
    const s = state(0, 0);
    const sale = forSaleNow(s);
    const locked = sale.filter((t) => !t.info.premium);
    expect(locked.length).toBe(Math.min(LOCKED_ON_SALE, CATALOG.length));
    expect(sale.filter((t) => t.info.premium).map((t) => t.id)).toEqual(PREMIUM_IDS);
    const first = locked[0].id;
    expect(forSaleNow(state(0, 0, [first])).some((t) => t.id === first)).toBe(false);
  });

  it('counts only the tracks the wallet can pay for right now', () => {
    const s = state(0, 0);
    expect(affordableCount(s)).toBe(0);
    const cheapest = Math.min(...forSaleNow(s).map((t) => t.price));
    expect(affordableCount(state(0, cheapest))).toBeGreaterThanOrEqual(1);
    expect(affordableCount(state(0, 1e9))).toBe(forSaleNow(s).length);
  });

  it('prices premium tracks with the premium multiplier', () => {
    const premium = forSaleNow(state(0, 0)).find((t) => t.info.premium);
    if (!premium) return;
    const track = CATALOG.find((t) => t.id === premium.id)!;
    expect(premium.price).toBe(trackPrice(track.stars, true));
  });
});
