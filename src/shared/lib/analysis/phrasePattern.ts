import { PHRASE_BARS, type Bar } from './bars';

/** Notes on (near-)silent slots are dropped — a note with nothing to hear feels random. */
export const MIN_NOTE_STRENGTH = 0.1;
/** Absolute floor on raw onset strength: below this a slot is silence, whatever the phrase boost says. */
export const MIN_RAW_STRENGTH = 0.05;
/** A profile step joins the pattern when it is a local peak reaching this share of the profile's max. */
const PATTERN_REL = 0.4;
/** Pattern steps this loud (share of profile max) are accents — the "ТУ": chords when a thumb is free. */
export const ACCENT_REL = 0.85;
/** In intense phrases a step next to a peak still joins the pattern when this loud — a sixteenth pair ("ta-ka"). */
const PAIR_REL = 0.7;
/** A bar "sounds" a pattern step when its own salience reaches this share of the profile at that step. */
export const SOUND_REL = 0.5;
/** Off-pattern hits are added only when very strong: fills, stabs, accents the figure did not predict. */
export const EXTRA_REL = 0.85;
/** Min gap between plain notes: a sixteenth inside intense bars, an eighth elsewhere. */
export const MIN_GAP_INTENSE = 1;
export const MIN_GAP_SLOTS = 2;
/** Rolls: a fill of ≥ this many sixteenths becomes one roll note; taps are capped. */
export const ROLL_MIN_TAPS = 3;
export const ROLL_MAX_TAPS = 6;
/** Every slot of a fill must be at least this audible (boosted salience), and the run this loud on average. */
export const ROLL_SLOT_SALIENCE = 0.18;
export const ROLL_MEAN_SALIENCE = 0.32;
/** Off-sixteenths inside the fill must be this many times louder than off-sixteenths in the rest of the bar. */
export const ROLL_CONTRAST = 1.5;

/** A 4-bar rhythm phrase and the figure the ear hears in it. */
export interface PhrasePattern {
  index: number;
  bars: Bar[];
  /** Per-step mean of boosted salience across the phrase's bars. */
  profile: number[];
  /** Pattern steps in placement priority order (loudest first). */
  steps: number[];
  accents: Set<number>;
  /** Max boosted salience of any slot in the phrase. */
  salMax: number;
  intense: boolean;
}

/** Grid preference: beats > eighths > sixteenths — breaks ties between equally loud steps the musical way. */
export const gridBonus = (step: number): number => (step % 4 === 0 ? 0.15 : step % 2 === 0 ? 0.05 : -0.12) + (step % 8 === 0 ? 0.03 : 0);

/**
 * Pattern steps of a phrase profile: local peaks (circular over the bar) reaching `PATTERN_REL` of
 * the max — plus, in intense phrases, steps next to a peak that are still very loud (sixteenth
 * pairs). Greedy by loudness with the min-gap rule, at most `cap` steps. Returned loudest first.
 */
export function patternSteps(profile: readonly number[], intense: boolean, cap: number): number[] {
  const n = profile.length;
  let max = 0;
  for (const v of profile) if (v > max) max = v;
  if (max < MIN_NOTE_STRENGTH) return [];
  const gap = intense ? MIN_GAP_INTENSE : MIN_GAP_SLOTS;
  const cand: { step: number; score: number }[] = [];
  for (let s = 0; s < n; s++) {
    const v = profile[s];
    if (v < PATTERN_REL * max) continue;
    const prev = profile[(s + n - 1) % n];
    const next = profile[(s + 1) % n];
    const peak = v >= prev && v >= next;
    if (!peak && !(intense && v >= PAIR_REL * max)) continue;
    cand.push({ step: s, score: v + gridBonus(s) });
  }
  cand.sort((a, b) => b.score - a.score || a.step - b.step);
  const chosen: number[] = [];
  for (const c of cand) {
    if (chosen.length >= cap) break;
    if (chosen.some((st) => Math.abs(st - c.step) < gap)) continue;
    chosen.push(c.step);
  }
  return chosen;
}

/**
 * Drum fill → roll: the bar ends with one or two beats where EVERY sixteenth sounds and the
 * off-sixteenths are clearly louder than in the rest of the bar (a fill, not a steady stream).
 * Phrase ends (bar 4/8/…) need less evidence — that is where fills live.
 */
export function detectFill(bar: Bar, strength: readonly number[]): { from: number; taps: number } | null {
  if (bar.intensity < 1) return null;
  const phraseEnd = bar.index % PHRASE_BARS === PHRASE_BARS - 1;
  let rollFrom = -1;
  let rollTaps = 0;
  const floor = phraseEnd ? ROLL_SLOT_SALIENCE * 0.75 : ROLL_SLOT_SALIENCE;
  const need = phraseEnd ? ROLL_MEAN_SALIENCE * 0.8 : ROLL_MEAN_SALIENCE;
  for (const len of [8, 4]) {
    const from = bar.slots.length - len;
    if (from < ROLL_MIN_TAPS) continue;
    let ok = true;
    let sum = 0;
    let offRun = 0;
    let offRunN = 0;
    for (let i = from; i < bar.slots.length; i++) {
      if (strength[i] < floor) ok = false;
      sum += strength[i];
      if (i % 2 === 1) {
        offRun += strength[i];
        offRunN++;
      }
    }
    if (!ok || sum / len < need) continue;
    let offRest = 0;
    let offRestN = 0;
    for (let i = 1; i < from; i += 2) {
      offRest += strength[i];
      offRestN++;
    }
    const contrast = offRun / Math.max(1, offRunN) / Math.max(0.06, offRest / Math.max(1, offRestN));
    if (contrast >= ROLL_CONTRAST) {
      rollFrom = from;
      rollTaps = Math.min(ROLL_MAX_TAPS, len);
      break;
    }
  }
  return rollFrom >= 0 ? { from: rollFrom, taps: rollTaps } : null;
}
