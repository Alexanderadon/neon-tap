/** Rolls: a fill of at least this many sixteenths becomes one roll note; taps are capped. */
export const ROLL_MIN_TAPS = 3;
export const ROLL_MAX_TAPS = 4;
/** A fill is two beats long (eight sixteenths) — anything shorter is a pickup, not a roll. */
const FILL_SLOTS = 8;
/** Every slot of a fill must be at least this audible on the drum stem, and the run this loud on average. */
const ROLL_SLOT_ONSET = 0.18;
const ROLL_MEAN_ONSET = 0.32;
/** Off-sixteenths inside the fill must be this many times louder than off-sixteenths in the rest of the bar. */
const ROLL_CONTRAST = 1.5;

/**
 * Drum fill → roll: the bar `[s0, s1)` of the drum stem ends with two beats where EVERY sixteenth
 * sounds and the off-sixteenths are clearly louder than in the rest of the bar (a fill, not a steady
 * stream). Returns the fill's first step (an offset from `s0`) and its tap count.
 */
export function detectFill(drumOnset: ArrayLike<number>, s0: number, s1: number): { from: number; taps: number } | null {
  const len = s1 - s0;
  const from = len - FILL_SLOTS;
  if (from < ROLL_MIN_TAPS) return null;
  let sum = 0;
  let offRun = 0;
  let offRunN = 0;
  for (let i = from; i < len; i++) {
    const v = drumOnset[s0 + i];
    if (v < ROLL_SLOT_ONSET) return null;
    sum += v;
    if (i % 2 === 1) {
      offRun += v;
      offRunN++;
    }
  }
  if (sum / FILL_SLOTS < ROLL_MEAN_ONSET) return null;
  let offRest = 0;
  let offRestN = 0;
  for (let i = 1; i < from; i += 2) {
    offRest += drumOnset[s0 + i];
    offRestN++;
  }
  const contrast = offRun / Math.max(1, offRunN) / Math.max(0.06, offRest / Math.max(1, offRestN));
  return contrast >= ROLL_CONTRAST ? { from, taps: Math.min(ROLL_MAX_TAPS, FILL_SLOTS) } : null;
}
