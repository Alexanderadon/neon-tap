import catalogJson from './catalog.json';
import scheduleJson from './schedule.json';
import { now } from '@/shared/lib/time';
import { isDropVisible, releaseMs, type DropSchedule } from './drops';
import type { TrackMeta } from './types';

/** Every built-in song as generated: the road easiest first, the packs, then the weekly tracks by date. */
const ALL: readonly TrackMeta[] = catalogJson as TrackMeta[];

export interface CatalogSplit {
  /** The deck: every non-weekly track, then the weekly ones already in view (from a week before release). */
  catalog: readonly TrackMeta[];
  /** Road and premium ids, without the weekly tracks: thresholds, the daily track and star totals never move with a drop. */
  trackIds: readonly string[];
  /** Premium ids (shop-only), weekly tracks excluded. */
  premiumIds: readonly string[];
  /** Every weekly track, in release order (visible or not). */
  drops: readonly TrackMeta[];
}

/** Splits the generated list into the deck, the road ids and the weekly tracks as of `nowMs`. */
export function splitCatalog(all: readonly TrackMeta[], nowMs: number): CatalogSplit {
  const base = all.filter((t) => t.drop !== true);
  const drops = all
    .map((t, i) => ({ t, i, at: releaseMs(t.release) }))
    .filter(({ t }) => t.drop === true)
    .sort((a, b) => (a.at === b.at ? a.i - b.i : a.at < b.at ? -1 : 1))
    .map(({ t }) => t);
  return {
    catalog: [...base, ...drops.filter((t) => isDropVisible(t, nowMs))],
    trackIds: base.map((t) => t.id),
    premiumIds: base.filter((t) => t.premium === true).map((t) => t.id),
    drops,
  };
}

/** Taken once per page load: a new week reaches an open app at its next load (no timer). */
const split = splitCatalog(ALL, now());

/** All built-in songs in deck order, easiest first; the weekly tracks in view come last (after the packs). */
export const CATALOG: readonly TrackMeta[] = split.catalog;

/** The road: every non-weekly id in catalog order (thresholds, the daily track, star totals). */
export const TRACK_IDS: readonly string[] = split.trackIds;

/** Shop-only tracks (`premium: true` in the registry) — never open by stars. */
export const PREMIUM_IDS: readonly string[] = split.premiumIds;

/** Every weekly track in release order, including the ones not in the deck yet. */
export const DROPS: readonly TrackMeta[] = split.drops;

/** The weekly schedule: the first Monday and the number of slots (`schedule.json`, generated with `catalog.json`). */
export const DROP_SCHEDULE: DropSchedule = { start: scheduleJson.start, weeks: scheduleJson.weeks };

/** Any built-in song by id, weekly tracks not yet in the deck included (covers, tints). */
export function findTrack(id: string): TrackMeta | undefined {
  return ALL.find((t) => t.id === id);
}
