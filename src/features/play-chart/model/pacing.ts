import { lowerBound } from '@/shared/lib/math';

/**
 * Silence in a level (review 26.09, «Доделать» 3). A level plays the song from its start, so a long
 * intro is half a minute of an empty field — on the third star a minute and a half, «игра зависла».
 * Two rules, both pure functions of the (sorted) notes:
 *  - a long intro is skipped: when the playing starts after INTRO_MAX_WAIT, the level starts
 *    INTRO_LEAD before it and the lone notes earlier than that are dropped for the run. The playing
 *    starts at the first note that is not a lone one — a lone note is followed by more than
 *    INTRO_MAX_WAIT of silence (All Night Road: 28.2 s, then nothing until 38.4 s). A sparse intro is
 *    playing too: a tile every 1.4 s for half a minute (Elevate) is a warm-up, not a silence, and stays;
 *  - an empty stretch of GAP_MIN or more (mid-song, or from the level's start) ends with a «3 · 2 · 1»
 *    over the hit line, one digit per real second, the last one going out as the next note lands.
 */
interface Timed {
  time: number;
  duration: number;
}

/** Seconds of silence a level still plays through: before the playing starts, and after a lone note. */
export const INTRO_MAX_WAIT = 8;
/** A skipped intro still leaves this much music before the playing starts. */
export const INTRO_LEAD = 4;
/** An empty stretch this long (song seconds) gets the count to the next note. */
export const GAP_MIN = 6;
/** The count's length: real seconds, a digit each. */
export const GAP_COUNT = 3;

/** Index of the note the playing starts with: the first one not followed by more than INTRO_MAX_WAIT of silence (the last note when all are). */
export function playingStartIndex(notes: readonly Timed[]): number {
  let i = 0;
  while (i + 1 < notes.length && notes[i + 1].time - (notes[i].time + notes[i].duration) > INTRO_MAX_WAIT) i++;
  return i;
}

/** Where the level starts, song seconds: 0, or INTRO_LEAD before the playing when that starts after INTRO_MAX_WAIT. */
export function introStart(notes: readonly Timed[]): number {
  if (notes.length === 0) return 0;
  const t = notes[playingStartIndex(notes)].time;
  return t > INTRO_MAX_WAIT ? t - INTRO_LEAD : 0;
}

/** The notes a level starting at `start` keeps: none from before it. */
export function notesFrom<T extends Timed>(notes: readonly T[], start: number): readonly T[] {
  return start > 0 ? notes.filter((n) => n.time >= start) : notes;
}

/** Times of the notes that end an empty stretch of at least GAP_MIN — counted from `start` for the first one. */
export function gapReturns(notes: readonly Timed[], start = 0): number[] {
  const out: number[] = [];
  let lastEnd = start;
  for (const n of notes) {
    if (n.time - lastEnd >= GAP_MIN) out.push(n.time);
    lastEnd = Math.max(lastEnd, n.time + n.duration);
  }
  return out;
}

/**
 * Real seconds left until the next note after a gap while its count runs (0 < left ≤ GAP_COUNT),
 * else -1. `rate` = song seconds per real second now (the level's speed, the slow spell).
 */
export function gapCountLeft(returns: readonly number[], songTime: number, rate: number): number {
  const i = lowerBound(returns, songTime);
  if (i >= returns.length) return -1;
  const left = (returns[i] - songTime) / Math.max(0.1, rate);
  return left > 0 && left <= GAP_COUNT ? left : -1;
}
