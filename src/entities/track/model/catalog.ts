import catalogJson from './catalog.json';
import type { TrackMeta } from './types';

/** All built-in songs, easiest first. */
export const CATALOG: readonly TrackMeta[] = catalogJson as TrackMeta[];

export const TRACK_IDS: readonly string[] = CATALOG.map((t) => t.id);

/** Shop-only tracks (`premium: true` in the registry) — never open by stars. */
export const PREMIUM_IDS: readonly string[] = CATALOG.filter((t) => t.premium === true).map((t) => t.id);

export function findTrack(id: string): TrackMeta | undefined {
  return CATALOG.find((t) => t.id === id);
}
