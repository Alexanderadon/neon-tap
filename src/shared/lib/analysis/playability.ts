/**
 * Test-only checkers for what a phone can actually play: two thumbs, one long note at a time, the
 * free thumb on its own half, a beat to let go. Every chart generator test (mix or instrument
 * layers) runs through these so the old two-finger bugs cannot come back.
 */
import { STEPS_PER_BAR, type Slot, type SongAnalysis } from './SongAnalyzer';
import { handOf } from './laneAssign';
import type { NoteTuple } from '@/shared/types/chart';

/** 120 BPM sixteenth grid with per-slot overrides. */
export function fakeAnalysis(bars: number, pattern: (bar: number, step: number) => Partial<Slot>): SongAnalysis {
  const slots: Slot[] = [];
  const beats: number[] = [];
  const step = 0.125; // 120 BPM sixteenth
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
    bpm: 120,
    confidence: 1,
    beats,
    slots,
    barCount: bars,
    duration: bars * 2,
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
  for (const h of notes.filter(isHoldType)) {
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
