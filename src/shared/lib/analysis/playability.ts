/**
 * Checkers for what a phone can actually play: two thumbs, one long note at a time, the free
 * thumb on its own half, a beat to let go, never two notes in one lane inside one judgement span,
 * nothing under a spinner. Every chart generator test (mix or instrument layers) runs through
 * these so the old two-finger bugs cannot come back, and `assertPlayable` is the generator's own
 * gate: a chart that fails it is never written.
 */
import { STEPS_PER_BAR, type Slot, type SongAnalysis } from './SongAnalyzer';
import { handOf } from './laneAssign';
import { FAST_RATE, budgetOf, rateStarsBudget } from './budget';
import type { ChartLevel, NoteTuple, SectionTuple } from '@/shared/types/chart';

/** No two notes in one lane closer than this (song s): both would sit inside one judgement span. */
export const SAME_LANE_MIN_SEC = 0.3;

/** A sixteenth grid at `bpm` (120 by default) with per-slot overrides. */
export function fakeAnalysis(bars: number, pattern: (bar: number, step: number) => Partial<Slot>, bpm = 120): SongAnalysis {
  const slots: Slot[] = [];
  const beats: number[] = [];
  const step = 15 / bpm;
  for (let b = 0; b < bars; b++) {
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      if (s % 4 === 0) beats.push((b * STEPS_PER_BAR + s) * step);
      slots.push({
        time: (b * STEPS_PER_BAR + s) * step,
        bar: b,
        step: s,
        strength: 0,
        low: 0.3,
        mid: 0.5,
        high: 0.2,
        sustain: 0,
        ...pattern(b, s),
      });
    }
  }
  beats.push(bars * STEPS_PER_BAR * step);
  return {
    bpm,
    confidence: 1,
    beats,
    slots,
    barCount: bars,
    duration: bars * STEPS_PER_BAR * step,
    onsetCount: 0,
    beatConfidence: 1,
  };
}

export const isHoldType = (n: NoteTuple) => n.length >= 3 && (n[2] as number) > 0;

/** Max simultaneous fingers a chart needs at any instant (notes starting + hold-types still active). */
export function maxFingers(notes: readonly NoteTuple[]): number {
  let worst = 0;
  const starts = [...new Set(notes.map((n) => n[0]))];
  for (const t of starts) {
    const starting = notes.filter((n) => n[0] === t).length;
    const holding = notes.filter((n) => isHoldType(n) && n[0] < t && n[0] + (n[2] as number) > t + 1e-6).length;
    worst = Math.max(worst, starting + holding);
  }
  return worst;
}

/**
 * Two-thumb violations: while a long note (hold / roll / slide) is active, every other note must
 * be on the OTHER thumb's half (the middle lane of an odd count counts for either), no circle may
 * start, and no second long note may start. Returns human-readable offenders.
 */
export function thumbViolations(notes: readonly NoteTuple[], sections: readonly [number, number][], releaseGap = 0.25): string[] {
  const lanesAt = (t: number) => sections.filter((s) => s[0] <= t + 1e-9).pop()![1];
  const startsAt = (t: number) => notes.filter((m) => m[0] === t).length;
  const out: string[] = [];
  for (const h of notes.filter((n) => isHoldType(n) && n[3] !== 'spin')) {
    const n = lanesAt(h[0]);
    const end = h[0] + (h[2] as number);
    const hand = handOf(h[1], n);
    for (const m of notes) {
      if (m === h || m[0] <= h[0]) continue;
      const during = m[0] < end - 1e-6;
      const releasing = !during && m[0] < end + releaseGap - 1e-6;
      if (!during && !releasing) continue;
      if (during && m[3] === 'circle') out.push(`circle at ${m[0]} during long note at ${h[0]}`);
      else if (during && isHoldType(m)) out.push(`long note at ${m[0]} during long note at ${h[0]}`);
      else if (hand !== -1 && handOf(m[1], lanesAt(m[0])) === hand)
        out.push(`note at ${m[0]} lane ${m[1]} on the busy thumb's half (hold lane ${h[1]}, ${n} lanes, ${during ? 'during' : 'while releasing'})`);
      else if (startsAt(m[0]) >= 2) out.push(`chord at ${m[0]} ${during ? 'during' : 'right after'} long note at ${h[0]}`);
    }
  }
  return out;
}

/**
 * Hand hops: a note that follows the previous one within a sixteenth (or a long note within an
 * eighth) on the SAME thumb's half in a different lane — one thumb cannot hop lanes that fast.
 * The middle lane of an odd field belongs to either hand and never counts.
 */
export function handHops(notes: readonly NoteTuple[], sections: readonly [number, number][], stepSec: number): string[] {
  const lanesAt = (t: number): number => {
    let n = sections[0][1];
    for (const [time, lanes] of sections) if (time <= t + 1e-6) n = lanes;
    return n;
  };
  const hand = (lane: number, n: number): -1 | 0 | 1 => {
    const c = (lane + 0.5) / n;
    return c < 0.5 ? 0 : c > 0.5 ? 1 : -1;
  };
  const out: string[] = [];
  const sorted = [...notes].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur[3] === 'circle' || prev[3] === 'circle') continue;
    const gap = cur[0] - prev[0];
    const limit = (cur[2] ?? 0) > 0 ? stepSec * 2 : stepSec;
    if (gap <= 0 || gap > limit + 1e-6) continue;
    const n = lanesAt(cur[0]);
    if (cur[1] === prev[1]) continue;
    const a = hand(prev[1], n);
    const b = hand(cur[1], n);
    if (a !== -1 && a === b) out.push(`hop at ${cur[0]}: lane ${prev[1]} → ${cur[1]} on one thumb (${n} lanes, gap ${gap.toFixed(3)})`);
  }
  return out;
}

/** Two lane notes (taps, holds, rolls, slides — circles float above the lanes) in ONE lane closer than `minSec`: both would sit inside one judgement span. */
export function sameLaneClose(notes: readonly NoteTuple[], minSec = SAME_LANE_MIN_SEC): string[] {
  const out: string[] = [];
  const byLane = new Map<number, NoteTuple[]>();
  for (const n of notes) {
    if (n[3] === 'spin' || n[3] === 'circle') continue;
    const list = byLane.get(n[1]) ?? [];
    list.push(n);
    byLane.set(n[1], list);
  }
  for (const [lane, list] of [...byLane.entries()].sort((a, b) => a[0] - b[0])) {
    list.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < list.length; i++) {
      const gap = list[i][0] - list[i - 1][0];
      if (gap > 0 && gap < minSec - 1e-9) out.push(`lane ${lane}: notes at ${list[i - 1][0]} and ${list[i][0]} only ${gap.toFixed(3)} s apart`);
    }
  }
  return out;
}

/** Smallest gap between two distinct event times (spinners excluded); Infinity below two events. */
export function minEventGap(notes: readonly NoteTuple[]): number {
  const times = [...new Set(notes.filter((n) => n[3] !== 'spin').map((n) => n[0]))].sort((a, b) => a - b);
  let min = Infinity;
  for (let i = 1; i < times.length; i++) min = Math.min(min, times[i] - times[i - 1]);
  return min;
}

/** Lane notes that start while a spinner is up: the field must be empty for the whole wheel. */
export function spinnerOverlap(notes: readonly NoteTuple[]): string[] {
  const out: string[] = [];
  for (const s of notes.filter((n) => n[3] === 'spin')) {
    const end = s[0] + (s[2] as number);
    for (const n of notes) if (n[3] !== 'spin' && n[0] >= s[0] - 1e-6 && n[0] < end - 1e-6) out.push(`note at ${n[0]} during spinner ${s[0]}–${end}`);
  }
  return out;
}

/** The lane notes (spinners excluded) inside the `winSec`-second window that holds the most distinct event times. */
export function densestWindow(notes: readonly NoteTuple[], winSec: number): NoteTuple[] {
  const lane = notes.filter((n) => n[3] !== 'spin');
  const times = [...new Set(lane.map((n) => n[0]))].sort((a, b) => a - b);
  let bestFrom = 0;
  let bestCount = 0;
  let j = 0;
  for (let i = 0; i < times.length; i++) {
    while (times[i] - times[j] > winSec) j++;
    if (i - j + 1 > bestCount) {
      bestCount = i - j + 1;
      bestFrom = times[j];
    }
  }
  return lane.filter((n) => n[0] >= bestFrom && n[0] <= bestFrom + winSec);
}

/** Budget rating of the densest `winSec` seconds alone — a level is lost in its worst phrase, not on average. */
export function worstWindowStars(notes: readonly NoteTuple[], bpm: number, sections?: readonly SectionTuple[], winSec = 8): number {
  return rateStarsBudget(densestWindow(notes, winSec), bpm, sections).stars;
}

/**
 * The generator's gate: throws, naming the offending notes, when the chart breaks a hands rule at
 * the fastest level — a thumb violation, a hand hop at ×1.2 (`stepSec` is a sixteenth in song
 * seconds), more than two fingers, two notes in one lane inside a judgement span, a note under a
 * spinner, or two events closer than the chart's ★ allows (its pair gap, else its grid gap).
 */
export function assertPlayable(chart: ChartLevel, stepSec: number): void {
  const sections: SectionTuple[] = chart.sections ?? [[0, 4]];
  const lane = chart.notes.filter((n) => n[3] !== 'spin');
  const b = budgetOf(chart.stars);
  const minGap = b.pairMinSec || b.minGapSec;
  const gap = minEventGap(lane);
  const fingers = maxFingers(lane);
  const problems = [
    ...thumbViolations(lane, sections),
    ...handHops(lane, sections, stepSec * FAST_RATE),
    ...(fingers > 2 ? [`${fingers} fingers needed at once`] : []),
    ...sameLaneClose(lane),
    ...spinnerOverlap(chart.notes),
    ...(gap < minGap - 1e-9 ? [`events ${gap.toFixed(3)} s apart, ★${chart.stars} allows ${minGap}`] : []),
  ];
  if (problems.length) throw new Error(`unplayable chart (${problems.length} problems):\n  ${problems.slice(0, 12).join('\n  ')}`);
}
