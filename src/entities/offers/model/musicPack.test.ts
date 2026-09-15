import { describe, expect, it } from 'vitest';
import { musicPack, packOwned, packValue, type PackTrack } from './musicPack';
import { CRYSTAL_PACKS, LIMITED_DEAL, crystalsFor, offerKindOf } from './catalogue';

const priceOf = (stars: number, premium: boolean) => Math.round((40 + 15 * stars) * (premium ? 1.5 : 1));

const catalog: PackTrack[] = [
  { id: 'a1', stars: 1 },
  { id: 'a2', stars: 2 },
  { id: 'p1', stars: 4, premium: true },
  { id: 'a5', stars: 5 },
  { id: 'a7', stars: 7 },
  { id: 'p2', stars: 8, premium: true },
  { id: 'a9', stars: 9 },
  { id: 'a10', stars: 10 },
  { id: 'a3', stars: 3 },
];

describe('musicPack', () => {
  it('takes the premium tracks first (dearest first), then the most expensive locked ones', () => {
    expect(musicPack(catalog, priceOf).map((t) => t.id)).toEqual(['p2', 'p1', 'a10', 'a9', 'a7', 'a5', 'a3', 'a2']);
  });

  it('is only premium when there are enough of them', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, stars: i + 1, premium: true }));
    const pack = musicPack([...catalog, ...many], priceOf);
    expect(pack).toHaveLength(8);
    expect(pack.every((t) => t.premium)).toBe(true);
    expect(pack[0].id).toBe('p9');
  });

  it('never exceeds the catalog and respects a custom size', () => {
    expect(musicPack(catalog.slice(0, 3), priceOf)).toHaveLength(3);
    expect(musicPack(catalog, priceOf, 2).map((t) => t.id)).toEqual(['p2', 'p1']);
  });

  it('sums the pack value and knows when everything is owned', () => {
    const pack = musicPack(catalog, priceOf, 2);
    expect(packValue(pack, priceOf)).toBe(priceOf(8, true) + priceOf(4, true));
    expect(packOwned(pack, ['p1'])).toBe(false);
    expect(packOwned(pack, ['p1', 'p2', 'x'])).toBe(true);
    expect(packOwned([], [])).toBe(false);
  });
});

describe('catalogue', () => {
  it('grows the bonus with the pack and doubles the middle pack in the deal', () => {
    expect(CRYSTAL_PACKS.map((p) => p.crystals)).toEqual([500, 1500, 4000]);
    expect(CRYSTAL_PACKS.map((p) => p.bonusPercent)).toEqual([0, 10, 25]);
    expect(LIMITED_DEAL.crystals).toBe(1500 * LIMITED_DEAL.multiplier);
    expect(crystalsFor('limited-48h')).toBe(3000);
    expect(crystalsFor('crystals-l')).toBe(4000);
    expect(crystalsFor('music-8')).toBe(0);
  });

  it('maps skus to popups', () => {
    expect(offerKindOf('crystals-s')).toBe('crystals');
    expect(offerKindOf('limited-48h')).toBe('limited');
    expect(offerKindOf('music-8')).toBe('music');
  });
});
