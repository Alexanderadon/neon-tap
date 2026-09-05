import catalogJson from './catalog.json';
import type { TrackMeta } from './types';
import { findLocalTrack } from './localCatalog';

/** All built-in songs, easiest first. Local dev tracks are a separate list — see `localCatalog.ts`. */
export const CATALOG: readonly TrackMeta[] = catalogJson as TrackMeta[];

export const TRACK_IDS: readonly string[] = CATALOG.map((t) => t.id);

/** Built-in track by id, else a loaded local track (built-in ids win on a collision). */
export function findTrack(id: string): TrackMeta | undefined {
  return CATALOG.find((t) => t.id === id) ?? findLocalTrack(id);
}
