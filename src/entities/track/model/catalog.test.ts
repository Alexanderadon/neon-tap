import { describe, expect, it } from 'vitest';
import { CATALOG, DROPS, DROP_SCHEDULE, PREMIUM_IDS, TRACK_IDS, findTrack, splitCatalog } from './catalog';
import { chaptersOf } from './chapters';
import { DAY_MS, isMonday, releaseMs } from './drops';
import type { TrackMeta } from './types';

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

const road = Array.from({ length: 12 }, (_, i) => track(`r${i}`));
const premium = [track('p0', { premium: true }), track('p1', { premium: true })];
const rock = [track('k0', { pack: 'rock' }), track('k1', { pack: 'rock' })];
// Listed out of date order on purpose: the split sorts by release.
const drops = [
  track('d2', { drop: true, release: '2026-10-19' }),
  track('d1', { drop: true, release: '2026-10-12' }),
  track('d0', { drop: true, release: '2026-10-05' }),
];
const all = [...road, ...premium, ...rock, ...drops];
const nonDrop = [...road, ...premium, ...rock].map((t) => t.id);

describe('splitCatalog', () => {
  it('keeps weekly tracks out of the road ids and the premium ids, whatever the date', () => {
    for (const nowMs of [0, releaseMs('2026-10-05'), releaseMs('2027-06-01')]) {
      const s = splitCatalog(all, nowMs);
      expect(s.trackIds).toEqual(nonDrop);
      expect(s.premiumIds).toEqual(['p0', 'p1']);
      expect(s.drops.map((t) => t.id)).toEqual(['d0', 'd1', 'd2']);
    }
  });

  it('puts a drop in the deck from seven days before its release, after the packs, by date', () => {
    const before = splitCatalog(all, releaseMs('2026-10-05') - 7 * DAY_MS - 1);
    expect(before.catalog.map((t) => t.id)).toEqual(nonDrop);
    const week0 = splitCatalog(all, releaseMs('2026-10-05') - 7 * DAY_MS);
    expect(week0.catalog.map((t) => t.id)).toEqual([...nonDrop, 'd0']);
    const later = splitCatalog(all, releaseMs('2026-10-12') + DAY_MS);
    expect(later.catalog.map((t) => t.id)).toEqual([...nonDrop, 'd0', 'd1', 'd2']);
  });

  it('keeps deck indices: the road tracks sit at the same positions as in the road ids', () => {
    const s = splitCatalog(all, releaseMs('2026-10-19'));
    s.trackIds.forEach((id, i) => expect(s.catalog[i].id).toBe(id));
    expect(s.catalog.length).toBe(s.trackIds.length + 3);
  });

  it('gives the deck the chapters: road, premium, the rock pack, then «Новинки»', () => {
    const s = splitCatalog(all, releaseMs('2026-10-19'));
    expect(chaptersOf(s.catalog).map((c) => [c.start, c.end, c.kind ?? c.pack ?? c.number])).toEqual([
      [0, 10, 1],
      [10, 12, 2],
      [12, 14, 'premium'],
      [14, 16, 'rock'],
      [16, 19, 'drops'],
    ]);
  });
});

describe('the built-in catalog', () => {
  it('has no weekly track in the road ids or the premium ids', () => {
    const dropIds = new Set(DROPS.map((t) => t.id));
    expect(TRACK_IDS.some((id) => dropIds.has(id))).toBe(false);
    expect(PREMIUM_IDS.some((id) => dropIds.has(id))).toBe(false);
    TRACK_IDS.forEach((id, i) => expect(CATALOG[i].id).toBe(id));
    expect(CATALOG.slice(TRACK_IDS.length).every((t) => t.drop === true)).toBe(true);
  });

  it('reads the schedule: 13 weeks from Monday 5 October 2026', () => {
    expect(DROP_SCHEDULE).toEqual({ start: '2026-10-05', weeks: 13 });
    expect(isMonday(DROP_SCHEDULE.start)).toBe(true);
  });

  it('finds any track by id', () => {
    expect(findTrack(TRACK_IDS[0])?.id).toBe(TRACK_IDS[0]);
    expect(findTrack('nope')).toBeUndefined();
  });
});
