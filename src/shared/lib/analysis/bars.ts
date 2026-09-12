import { LANE_COUNT } from '@/shared/config/constants';
import { percentile } from '@/shared/lib/math';
import type { NoteKind } from '@/shared/types/chart';
import type { Slot } from './SongAnalyzer';

/** A rhythm phrase: the pattern is computed over this many bars and repeated in each of them. */
export const PHRASE_BARS = 4;
/** A song is energetic when its mean bar intensity reaches this: denser, more lane changes. */
const ENERGETIC_MEAN_INTENSITY = 1.2;

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
  intensity: 0 | 1 | 2;
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
  /** The "ТУ" of the figure: chord when a thumb is free, otherwise an outer lane. */
  accent: boolean;
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
        intensity: 1,
        lanes: LANE_COUNT,
      };
      bars.push(bar);
    }
    bar.slots.push(s);
  }
  return bars;
}

/**
 * Bar intensity (0 quiet / 1 medium / 2 intense) from the smoothed mean onset strength of the bar —
 * mostly "how many audible hits per bar". Quantiles over the track find the song's own loud and
 * quiet parts; absolute thresholds keep a wall-to-wall banger from being split into fake quiet
 * parts (a bar with sixteenths everywhere is intense whatever the rest of the song does), which is
 * also what makes such a song "energetic" (mean intensity ≥ 1.2).
 */
const INTENSE_ABS = 0.45;
const MEDIUM_ABS = 0.3;
export function rateIntensity(bars: Bar[]): void {
  const e = bars.map((b) => b.slots.reduce((acc, s) => acc + s.strength, 0) / Math.max(1, b.slots.length));
  // Smooth within a phrase only: a chorus starting at bar 8 must not be dragged down by the intro.
  const sm = e.map((_, i) => {
    const prev = i % PHRASE_BARS === 0 ? e[i] : (e[i - 1] ?? e[i]);
    const next = i % PHRASE_BARS === PHRASE_BARS - 1 ? e[i] : (e[i + 1] ?? e[i]);
    return 0.25 * prev + 0.5 * e[i] + 0.25 * next;
  });
  const q35 = percentile(sm, 0.35);
  const q70 = percentile(sm, 0.7);
  for (let i = 0; i < bars.length; i++) {
    const v = sm[i];
    bars[i].intensity = v >= Math.min(Math.max(q70, MEDIUM_ABS), INTENSE_ABS) ? 2 : v >= Math.min(Math.max(q35, 0.1), MEDIUM_ABS) ? 1 : 0;
  }
}

/** Energetic songs (mean bar intensity ≥ 1.2) get denser charts and lane decisions every 4 bars. */
export function isEnergetic(bars: readonly Bar[]): boolean {
  if (!bars.length) return false;
  return bars.reduce((a, b) => a + b.intensity, 0) / bars.length >= ENERGETIC_MEAN_INTENSITY;
}
