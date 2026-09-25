import { describe, expect, it } from 'vitest';
import { CATALOG, releaseMs, splitCatalog, type TrackMeta } from '@/entities/track';
import { dailyTrackId, unlockStates } from '@/entities/progress';
import { emptySave } from '@/entities/progress/model/SaveData';
import { dropLocks, passDropGrants } from './dropLocks';
import { buildCatalogState, lockFor, type CatalogState } from './useCatalogState';
import { forSaleNow } from './shopBadge';

function track(id: string, extra: Partial<TrackMeta> = {}): TrackMeta {
  return {
    id,
    title: id,
    artist: 'a',
    license: 'CC0',
    sourceUrl: '',
    genre: 'rock',
    bpm: 120,
    duration: 60,
    stars: 3,
    notes: 100,
    features: { circles: 0, rolls: 0, slides: 0, holds: 0, laneChanges: 0 },
    ...extra,
  };
}

const DAY = 86_400_000;
const base = [...Array.from({ length: 30 }, (_, i) => track(`r${i}`)), track('p0', { premium: true }), track('k0', { pack: 'rock' })];
const drops = [
  track('d0', { drop: true, release: '2026-10-05' }),
  track('d1', { drop: true, release: '2026-10-12' }),
  track('d2', { drop: true, release: '2026-10-19' }),
];
/** Tuesday of week 2: d0 and d1 are out, d2 is «soon» (visible, a week ahead). */
const NOW = releaseMs('2026-10-12') + DAY;

/** A catalog state for the fixture: the road of the fixture, its weekly locks. */
function fixtureState(purchased: string[] = [], pass = false): CatalogState {
  const split = splitCatalog([...base, ...drops], NOW);
  const state = buildCatalogState({ ...emptySave(), purchased }, NOW, pass);
  const list = unlockStates(split.trackIds, { stars: 0, purchased, premium: split.premiumIds });
  return {
    ...state,
    unlocks: new Map(list.map((u) => [u.id, u])),
    drops: dropLocks(split.drops, { nowMs: NOW, purchased, pass, unlockAll: false }),
  };
}

describe('weekly tracks and the road', () => {
  it('leave the road ids, the thresholds and the daily track exactly as they were', () => {
    const without = splitCatalog(base, NOW);
    for (const nowMs of [0, NOW, releaseMs('2027-01-04')]) {
      const withDrops = splitCatalog([...drops, ...base], nowMs);
      expect(withDrops.trackIds).toEqual(without.trackIds);
      const a = unlockStates(without.trackIds, { stars: 20, premium: without.premiumIds });
      const b = unlockStates(withDrops.trackIds, { stars: 20, premium: withDrops.premiumIds });
      expect(b.map((u) => u.need)).toEqual(a.map((u) => u.need));
      for (const date of ['2026-10-05', '2026-10-13', '2026-12-31']) {
        expect(dailyTrackId(date, withDrops.trackIds)).toBe(dailyTrackId(date, without.trackIds));
        expect(dailyTrackId(date, withDrops.trackIds)?.startsWith('d')).toBe(false);
      }
    }
  });

  it('give every weekly track in the deck a lock — never «unknown id, so open»', () => {
    const state = fixtureState();
    const visible = splitCatalog([...base, ...drops], NOW).catalog.filter((t) => t.drop);
    expect(visible.map((t) => t.id)).toEqual(['d0', 'd1', 'd2']);
    for (const t of visible) {
      const lock = lockFor(state, t.id, t.stars);
      expect(lock.drop).toBeDefined();
      expect(lock.locked).toBe(true);
      expect(lock.need).toBe(0);
    }
    expect(lockFor(state, 'd0', 3)).toMatchObject({ price: 150, premium: false });
    expect(lockFor(state, 'd2', 3).drop).toMatchObject({ soon: true, adEligible: false });
    expect(lockFor(state, 'd1', 3).drop).toMatchObject({ thisWeek: true, adEligible: true });
  });

  it('looks up the weekly map first, and the built-in deck has a lock for each of its weekly tracks', () => {
    expect(lockFor(fixtureState(['d0']), 'd0', 3)).toMatchObject({ locked: false, price: 0 });
    expect(lockFor(fixtureState([], true), 'd2', 3)).toMatchObject({ locked: false, drop: { early: true } });
    const real = buildCatalogState(emptySave());
    for (const t of CATALOG.filter((c) => c.drop)) expect(lockFor(real, t.id, t.stars).drop).toBeDefined();
  });

  it('PASS grants the weekly tracks in the deck the player does not own yet', () => {
    const catalog = splitCatalog([...base, ...drops], NOW).catalog;
    expect(passDropGrants(catalog, ['d1'], true)).toEqual(['d0', 'd2']);
    expect(passDropGrants(catalog, [], false)).toEqual([]);
  });

  it('the shop badge counts a released weekly track (150) first, never one still to come or owned', () => {
    const catalog = splitCatalog([...base, ...drops], NOW).catalog;
    const sale = forSaleNow(fixtureState(), catalog);
    expect(sale.slice(0, 2).map((t) => [t.id, t.price])).toEqual([
      ['d0', 150],
      ['d1', 150],
    ]);
    expect(sale.some((t) => t.id === 'd2')).toBe(false);
    expect(forSaleNow(fixtureState(['d0']), catalog).some((t) => t.id === 'd0')).toBe(false);
  });
});
