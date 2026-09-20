/** Speed of the song (and the tiles) at each level: the first pass as written, then faster. */
export const LEVEL_RATES = [1, 1.12, 1.2] as const;
export const LEVELS = LEVEL_RATES.length;
/** Endless mode: every loop past the third comes back this much faster, up to the cap (the music stays the music). */
export const ENDLESS_STEP = 0.05;
export const ENDLESS_MAX_RATE = 1.6;

/** Playback rate of a level (1-based); levels past LEVELS are endless loops. */
export function levelRate(level: number): number {
  if (level <= LEVELS) return LEVEL_RATES[Math.max(1, level) - 1];
  return Math.min(ENDLESS_MAX_RATE, Math.round((LEVEL_RATES[LEVELS - 1] + ENDLESS_STEP * (level - LEVELS)) * 100) / 100);
}

export interface LevelOutcome {
  /** Levels finished, up to three — a star each. */
  stars: number;
  /** Endless loops finished past the third level — a crown each. */
  crowns: number;
  /** The next pass to play, or null when the run is over. */
  next: number | null;
}

/**
 * A run is one song played up to three times in a row, faster each time; finishing a level earns
 * its star. In endless mode the song keeps coming back, faster still, and every loop past the
 * third earns a crown. What happens when a pass ends (finished or failed):
 *  - finished, more to play → `next` (the song fades out and comes back faster);
 *  - finished the third, not endless → `done` with all stars;
 *  - failed → `done` with the stars and crowns earned so far (a failed first level earns nothing).
 */
export function levelOutcome(level: number, failed: boolean, endless = false): LevelOutcome {
  const done = failed ? level - 1 : level;
  const stars = Math.max(0, Math.min(LEVELS, done));
  const crowns = Math.max(0, done - LEVELS);
  if (failed) return { stars, crowns, next: null };
  return { stars, crowns, next: level < LEVELS || endless ? level + 1 : null };
}
