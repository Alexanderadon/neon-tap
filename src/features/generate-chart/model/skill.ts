import { MAX_STARS } from '@/shared/lib/analysis';
import { CATALOG, type TrackMeta } from '@/entities/track';
import { starsForTrack, type SaveData } from '@/entities/progress';

/** The ceiling of a newcomer's first own song. */
export const SKILL_FLOOR = 2;

/**
 * The ★ an own song may reach for this player: one above the hardest catalog track they have passed
 * (a level or more), never under ★2 and never over ★6. The song's energy may still pick lower.
 */
export function skillStars(tracks: SaveData['tracks'], catalog: readonly Pick<TrackMeta, 'id' | 'stars'>[] = CATALOG): number {
  let best = 0;
  for (const t of catalog) if (starsForTrack(tracks[t.id]) > 0) best = Math.max(best, t.stars);
  return Math.min(MAX_STARS, Math.max(SKILL_FLOOR, best + 1));
}
