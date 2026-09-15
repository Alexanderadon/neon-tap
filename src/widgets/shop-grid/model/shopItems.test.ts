import { describe, expect, it } from 'vitest';
import type { TrackMeta } from '@/entities/track';
import { trackPrice, unlockThreshold } from '@/entities/progress';
import { LOCKED_ON_SALE, shopItems, stableOrder } from './shopItems';

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
    const stars = 3; // t0–t5 open by stars, t6 (needs 4) and up are locked
    const items = shopItems({ catalog, stars, premium, purchased: ['t9', 't15'] });
    expect(items.map((i) => i.kind)).toEqual([...Array(LOCKED_ON_SALE).fill('locked'), 'premium', 'owned', 'owned']);
    expect(items.map((i) => i.track.id)).toEqual(['t6', 't7', 't8', 't10', 't11', 't12', 't3', 't9', 't15']);
    // tracks open by stars alone are not for sale
    expect(items.some((i) => ['t0', 't1', 't2', 't4', 't5'].includes(i.track.id))).toBe(false);
  });

  it('tells how many stars are still missing on a locked card, and prices premium ×1.5', () => {
    const stars = 3;
    const items = shopItems({ catalog, stars, premium, purchased: [] });
    const t6 = items.find((i) => i.track.id === 't6')!;
    expect(t6.starsShort).toBe(unlockThreshold(6, catalog.length) - stars);
    expect(t6.starsShort).toBeGreaterThan(0);
    expect(t6.price).toBe(trackPrice(catalog[6].stars));
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
