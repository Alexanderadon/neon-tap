import { LANE_COUNT } from '@/shared/config/constants';
import { percentile } from '@/shared/lib/math';
import type { NoteKind } from '@/shared/types/chart';
import type { Slot } from './SongAnalyzer';

/** A rhythm phrase: the figure is computed over this many bars and repeated in each of them. */
export const PHRASE_BARS = 4;

/**
 * Salience = what a listener would tap along to: kicks, snares and melody count fully,
 * hi-hat-only ticks (energy almost all above 2 kHz) count much less.
 */
export function salience(s: Slot): number {
  return s.strength * (0.5 + 0.5 * (1 - s.high));
}

export interface Bar {
  index: number;
  start: number; // slot index
  slots: Slot[];
  /** The phrase's level (0 quiet / 1 medium / 2 loud) — never decided per bar, see `phraseLevels`. */
  level: 0 | 1 | 2;
  /** Mean onset strength of the bar's slots (breakdowns for spinners are found against the song's median). */
  energy: number;
  lanes: number;
}

export interface Event {
  si: number;
  bar: Bar;
  step: number;
  size: number; // chord size
  hold: number; // slots, 0 = tap
  kind: NoteKind | null;
  /** Roll taps. */
  taps: number;
  /** The "ТУ" of the figure: a chord candidate. */
  accent: boolean;
  /** Signature of the phrase figure (sorted steps): lane memory follows the figure, not the phrase index. */
  figure: string;
}

export const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/** Tiny deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 0..1 value for (seed, phrase, step, salt): the same decision for the same step in every bar of a phrase. */
export function decide(seed: number, phrase: number, step: number, salt: number): number {
  let h = 2166136261 ^ seed;
  for (const p of [phrase, step, salt]) {
    h = Math.imul(h ^ (p | 0), 16777619);
    h ^= h >>> 13;
  }
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function groupBars(slots: readonly Slot[]): Bar[] {
  const bars: Bar[] = [];
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    let bar = bars[bars.length - 1];
    if (!bar || bar.index !== s.bar) {
      bar = {
        index: s.bar,
        start: i,
        slots: [],
        level: 1,
        energy: 0,
        lanes: LANE_COUNT,
      };
      bars.push(bar);
    }
    bar.slots.push(s);
  }
  for (const bar of bars) bar.energy = bar.slots.reduce((acc, s) => acc + s.strength, 0) / Math.max(1, bar.slots.length);
  return bars;
}

/** A hit is "clear" when its audibility reaches this. */
const CLEAR_AUD = 0.5;
/** Loud phrases: the top 40 % of phrase energies (≥ q60) with at least this many clear hits per bar. */
const LOUD_QUANTILE = 0.6;
const LOUD_MIN_CLEAR = 2;
/** Quiet phrases: the bottom 25 %, or fewer than one clear hit per bar. */
const QUIET_QUANTILE = 0.25;
const QUIET_MAX_CLEAR = 1;
/** Hysteresis: a phrase changes level only when its energy differs this much from the previous phrase's. */
const LEVEL_HYSTERESIS = 0.1;

const isPeak = (arr: ArrayLike<number>, i: number): boolean => arr[i] >= (arr[i - 1] ?? 0) && arr[i] >= (arr[i + 1] ?? 0);

/** Clear hits per bar of a phrase: local maxima of audibility at or above `CLEAR_AUD`. */
export function clearHitsPerBar(phrase: readonly Bar[], aud: ArrayLike<number>): number {
  let n = 0;
  for (const b of phrase) for (let k = 0; k < b.slots.length; k++) if (aud[b.start + k] >= CLEAR_AUD && isPeak(aud, b.start + k)) n++;
  return n / Math.max(1, phrase.length);
}

/**
 * One level per 4-bar phrase from the song's own quantiles: phrase energy = clear hits per bar
 * plus four times the mean onset strength. Level 2 (loud) = the top 40 % with ≥ 2 clear hits per
 * bar; level 0 (quiet) = the bottom 25 % or < 1 clear hit per bar; 1 otherwise. Hysteresis: a
 * phrase keeps the previous phrase's level while its energy is within 10 % of it, so a flat banger
 * does not flip on a quantile boundary. Writes `Bar.level`; never decided per bar.
 */
export function phraseLevels(bars: readonly Bar[], aud: ArrayLike<number>): (0 | 1 | 2)[] {
  const phrases: Bar[][] = [];
  for (let p = 0; p * PHRASE_BARS < bars.length; p++) phrases.push(bars.slice(p * PHRASE_BARS, (p + 1) * PHRASE_BARS));
  const clear = phrases.map((ph) => clearHitsPerBar(ph, aud));
  const energy = phrases.map((ph, p) => clear[p] + 4 * (ph.reduce((a, b) => a + b.energy, 0) / Math.max(1, ph.length)));
  const loud = percentile(energy, LOUD_QUANTILE);
  const quiet = percentile(energy, QUIET_QUANTILE);
  const raw = phrases.map((_, p): 0 | 1 | 2 => {
    if (clear[p] < QUIET_MAX_CLEAR) return 0;
    if (energy[p] >= loud && clear[p] >= LOUD_MIN_CLEAR) return 2;
    return energy[p] <= quiet ? 0 : 1;
  });
  const levels: (0 | 1 | 2)[] = [];
  for (let p = 0; p < phrases.length; p++) {
    const prev = levels[p - 1];
    const same = p > 0 && Math.abs(energy[p] - energy[p - 1]) < LEVEL_HYSTERESIS * Math.max(energy[p], energy[p - 1]);
    const level = prev !== undefined && same ? prev : raw[p];
    levels.push(level);
    for (const b of phrases[p]) b.level = level;
  }
  return levels;
}
