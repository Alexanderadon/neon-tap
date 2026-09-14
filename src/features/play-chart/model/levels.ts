/** Speed of the song (and the tiles) at each level: the first pass as written, then faster. */
export const LEVEL_RATES = [1, 1.12, 1.2] as const;
export const LEVELS = LEVEL_RATES.length;

/** Playback rate of a level (1-based). */
export function levelRate(level: number): number {
  return LEVEL_RATES[Math.max(1, Math.min(LEVELS, level)) - 1];
}

/**
 * A run is one song played up to three times in a row, faster each time; finishing a level earns
 * its star. What happens when a level ends (finished or failed):
 *  - finished, more levels left → `next` (the song fades out and comes back faster);
 *  - finished, last level → `done` with all stars;
 *  - failed → `done` with the stars earned so far (a failed first level earns nothing).
 */
export function levelOutcome(level: number, failed: boolean): { stars: number; next: number | null } {
  if (failed) return { stars: level - 1, next: null };
  return { stars: level, next: level < LEVELS ? level + 1 : null };
}
