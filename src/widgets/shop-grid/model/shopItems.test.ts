import { describe, expect, it } from 'vitest';
import { releaseMs, type TrackMeta } from '@/entities/track';
import { trackPrice, unlockThreshold } from '@/entities/progress';
import { LOCKED_ON_SALE, dropShopItems, shopItems, shopList, stableOrder } from './shopItems';

function track(i: number, extra: Partial<TrackMeta> = {}): TrackMeta {
  return {
    id: `t${i}`,
    title: `Track ${i}`,
    artist: 'a',
    license: 'CC0',
    sourceUrl: '',
    genre: 'rock',
    bpm: 120,
    duration: 60,
    stars: 1 + (i % 10),
    notes: 100,
    features: { circles: 0, rolls: 0, slides: 0, holds: 0, laneChanges: 0 },
    ...extra,
  };
}

const catalog = Array.from({ length: 20 }, (_, i) => track(i, i === 3 || i === 15 ? { premium: true } : {}));
const premium = ['t3', 't15'];

describe('shopItems', () => {
  it('lists star-locked tracks first (the next few on the road), then premium, owned at the bottom', () => {
    // The road skips the premium t3: t0–t6 (road places 0–5) open with 3 stars, t7 (place 6, needs 4) and up are locked.
    const stars = 3;
    const items = shopItems({ catalog, stars, premium, purchased: ['t9', 't15'] });
    expect(items.map((i) => i.kind)).toEqual([...Array(LOCKED_ON_SALE).fill('locked'), 'premium', 'owned', 'owned']);
    expect(items.map((i) => i.track.id)).toEqual(['t7', 't8', 't10', 't11', 't12', 't13', 't3', 't9', 't15']);
    // tracks open by stars alone are not for sale
    expect(items.some((i) => ['t0', 't1', 't2', 't4', 't5', 't6'].includes(i.track.id))).toBe(false);
  });

  it('tells how many stars are still missing on a locked card, and prices premium with its multiplier', () => {
    const stars = 3;
    const items = shopItems({ catalog, stars, premium, purchased: [] });
    const t7 = items.find((i) => i.track.id === 't7')!;
    expect(t7.starsShort).toBe(unlockThreshold(6, catalog.length - premium.length) - stars);
    expect(t7.starsShort).toBeGreaterThan(0);
    expect(t7.price).toBe(trackPrice(catalog[7].stars));
    const t3 = items.find((i) => i.track.id === 't3')!;
    expect(t3.kind).toBe('premium');
    expect(t3.starsShort).toBe(0);
    expect(t3.price).toBe(trackPrice(catalog[3].stars, true));
  });

  it('keeps the opening order after a purchase: the bought card stays put, it sinks next visit', () => {
    const before = shopItems({ catalog, stars: 3, premium, purchased: [] });
    const order = before.map((i) => i.track.id);
    const after = shopItems({ catalog, stars: 3, premium, purchased: ['t3'] });
    // live order: t3 became owned and moved to the bottom
    expect(after[after.length - 1].track.id).toBe('t3');
    const kept = stableOrder(after, order);
    expect(kept.map((i) => i.track.id)).toEqual(order);
    expect(kept.find((i) => i.track.id === 't3')?.kind).toBe('owned');
    // a newly listed id (not in the opening order) goes last
    const extra = stableOrder(
      after,
      order.filter((id) => id !== 't7'),
    );
    expect(extra[extra.length - 1].track.id).toBe('t7');
  });

  it('is empty when everything is open and nothing premium is left to buy', () => {
    expect(shopItems({ catalog, stars: 999, premium, purchased: ['t3', 't15'] }).map((i) => i.kind)).toEqual(['owned', 'owned']);
    expect(shopItems({ catalog: catalog.filter((t) => !t.premium), stars: 999, premium: [], purchased: [] })).toEqual([]);
  });
});

describe('weekly tracks in the shop', () => {
  const DAY = 86_400_000;
  const drops = [
    track(100, { id: 'd0', drop: true, release: '2026-10-05' }),
    track(101, { id: 'd1', drop: true, release: '2026-10-12' }),
    track(102, { id: 'd2', drop: true, release: '2026-10-19' }),
  ];
  /** Tuesday of week 2: d0 is 8 days out, d1 this week's, d2 next Monday's. */
  const NOW = releaseMs('2026-10-12') + DAY;
  const ctx = { drops, nowMs: NOW, purchased: [] as string[], pass: false, unlockAll: false };

  it('are never in shopItems: the road list and its thresholds ignore them', () => {
    const plain = shopItems({ catalog, stars: 3, premium, purchased: [] });
    const mixed = shopItems({ catalog: [...catalog, ...drops], stars: 3, premium, purchased: [] });
    expect(mixed).toEqual(plain);
    expect(mixed.some((i) => i.track.drop)).toBe(false);
  });

  it('fill the first shelf: out and not owned, newest first, 150 each; one still to come is not for sale', () => {
    const { sale, owned } = dropShopItems(ctx);
    expect(sale.map((i) => [i.track.id, i.kind, i.price])).toEqual([
      ['d1', 'drop', 150],
      ['d0', 'drop', 150],
    ]);
    expect(sale[0].drop).toMatchObject({ thisWeek: true, adEligible: true });
    expect(sale[1].drop).toMatchObject({ thisWeek: false, adEligible: true });
    expect(owned).toEqual([]);
    // Past the 14 days the ad is gone, the crystals stay.
    expect(dropShopItems({ ...ctx, nowMs: releaseMs('2026-10-19') + DAY }).sale.find((i) => i.track.id === 'd0')?.drop?.adEligible).toBe(false);
  });

  it('put owned weekly tracks at the very bottom; PASS or unlock-all leave nothing to sell', () => {
    const { sale, owned } = dropShopItems({ ...ctx, purchased: ['d1'] });
    expect(sale.map((i) => i.track.id)).toEqual(['d0']);
    expect(owned.map((i) => [i.track.id, i.kind])).toEqual([['d1', 'owned']]);
    const road = shopItems({ catalog, stars: 3, premium, purchased: ['t9'] });
    const list = shopList(road, { sale, owned });
    expect(list[0].track.id).toBe('d0');
    expect(list.slice(-2).map((i) => i.track.id)).toEqual(['t9', 'd1']);
    expect(dropShopItems({ ...ctx, pass: true }).sale).toEqual([]);
    expect(dropShopItems({ ...ctx, unlockAll: true }).sale).toEqual([]);
  });
});
