import { JUDGEMENT_SCORE } from '@/shared/config/constants';
import type { ResultTimeline } from '@/shared/types/result';

/** A stretch of consecutive judgements without a miss (indices into the timeline, times in seconds). */
export interface Streak {
  /** Song time of the first judgement of the streak. */
  from: number;
  /** Song time of the last judgement of the streak. */
  to: number;
  /** Judgements in the streak. */
  count: number;
  /** Timeline index range [start, end]. */
  start: number;
  end: number;
}

/** A fixed-length time window with its miss count. */
export interface MissWindow {
  from: number;
  to: number;
  misses: number;
}

/** A time range for the best-moment replay. */
export interface TimeRange {
  from: number;
  to: number;
}

export interface ResultHighlights {
  bestStreak: Streak | null;
  firstMiss: number | null;
  worstWindow: MissWindow | null;
}

/** Longest run of consecutive non-miss judgements; `null` when nothing was judged or every judgement was a miss. */
export function longestStreak(tl: ResultTimeline): Streak | null {
  let best: Streak | null = null;
  let start = -1;
  const n = tl.j.length;
  for (let i = 0; i <= n; i++) {
    const miss = i === n || tl.j[i] === 'miss';
    if (!miss) {
      if (start < 0) start = i;
      continue;
    }
    if (start >= 0) {
      const count = i - start;
      if (!best || count > best.count) best = { from: tl.t[start], to: tl.t[i - 1], count, start, end: i - 1 };
      start = -1;
    }
  }
  return best;
}

/** Song time of the first miss, or `null` for a miss-free run. */
export function firstMissTime(tl: ResultTimeline): number | null {
  for (let i = 0; i < tl.j.length; i++) if (tl.j[i] === 'miss') return tl.t[i];
  return null;
}

/**
 * The `windowSec`-long window holding the most misses (earliest on ties). The window starts on a
 * miss and is clipped to `duration` when given. `null` when there were no misses.
 */
export function worstWindow(tl: ResultTimeline, windowSec = 10, duration = Infinity): MissWindow | null {
  const misses: number[] = [];
  for (let i = 0; i < tl.j.length; i++) if (tl.j[i] === 'miss') misses.push(tl.t[i]);
  if (misses.length === 0) return null;
  let best = -1;
  let bestCount = 0;
  let hi = 0;
  for (let lo = 0; lo < misses.length; lo++) {
    while (hi < misses.length && misses[hi] <= misses[lo] + windowSec) hi++;
    const count = hi - lo;
    if (count > bestCount) {
      bestCount = count;
      best = lo;
    }
  }
  const from = misses[best];
  return { from, to: Math.min(from + windowSec, duration), misses: bestCount };
}

/** Accuracy after each judgement (same weights as `accuracyOf`), one value per timeline entry. */
export function runningAccuracy(tl: ResultTimeline): number[] {
  const out = new Array<number>(tl.j.length);
  let earned = 0;
  for (let i = 0; i < tl.j.length; i++) {
    earned += JUDGEMENT_SCORE[tl.j[i]];
    out[i] = earned / ((i + 1) * JUDGEMENT_SCORE.perfect);
  }
  return out;
}

/**
 * Resample a step series (`values[i]` holds from `times[i]` until the next entry) onto `samples`
 * evenly spaced points over [0, duration]. `initial` is the value before the first entry.
 */
export function sampleStep(times: readonly number[], values: readonly number[], duration: number, samples: number, initial = 0): number[] {
  const out = new Array<number>(Math.max(0, samples));
  let k = 0;
  let cur = initial;
  for (let s = 0; s < samples; s++) {
    const t = samples === 1 ? duration : (s / (samples - 1)) * duration;
    while (k < times.length && times[k] <= t) cur = values[k++];
    out[s] = cur;
  }
  return out;
}

/** Combo after each judgement resampled on an even time grid (0 before the first judgement). */
export function comboCurve(tl: ResultTimeline, duration: number, samples: number): number[] {
  return sampleStep(tl.t, tl.combo, duration, samples, 0);
}

/** Running accuracy resampled on an even time grid (1 before the first judgement). */
export function accuracyCurve(tl: ResultTimeline, duration: number, samples: number): number[] {
  return sampleStep(tl.t, runningAccuracy(tl), duration, samples, 1);
}

/**
 * Pick the `length`-second slice of [from, to] that contains the most of `times` (sorted ascending).
 * A range shorter than `length` is centred inside the slice. Never starts before 0.
 */
export function densestSlice(times: readonly number[], from: number, to: number, length: number): TimeRange {
  if (to - from <= length) {
    const start = Math.max(0, from - (length - (to - from)) / 2);
    return { from: start, to: start + length };
  }
  const last = to - length;
  let best = from;
  let bestCount = -1;
  let hi = 0;
  for (let lo = 0; lo < times.length; lo++) {
    const s = times[lo];
    if (s < from) continue;
    if (s > last) break;
    while (hi < times.length && times[hi] <= s + length) hi++;
    const count = hi - lo;
    if (count > bestCount) {
      bestCount = count;
      best = s;
    }
  }
  return { from: best, to: best + length };
}

/** The three story beats of a run. */
export function summarizeTimeline(tl: ResultTimeline, duration: number): ResultHighlights {
  return { bestStreak: longestStreak(tl), firstMiss: firstMissTime(tl), worstWindow: worstWindow(tl, 10, duration) };
}

/** Seconds → `m:ss` (floored). */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}
