import { lowerBound } from '@/shared/lib/math';

/** Beat-pulse strengths: every 4th beat (a downbeat — beat lists start on one) hits harder. */
export const DOWNBEAT_STRENGTH = 1;
export const BEAT_STRENGTH = 0.55;
export const BEATS_PER_BAR = 4;

/**
 * Walks a chart's beat list as the song plays and reports every beat the song time has just
 * crossed. Zero allocations after construction; seeking backwards (restart, resume rewinds
 * by a second) re-syncs the cursor instead of replaying the beats in between.
 */
export class BeatCursor {
  private readonly beats: readonly number[];
  private index = 0;
  private lastTime = -Infinity;

  constructor(beats: readonly number[] | undefined, bpm = 120, offset = 0, duration = 0) {
    this.beats = beats && beats.length >= 2 ? beats : BeatCursor.grid(bpm, offset, duration);
  }

  /** Beat grid for tracks without a tracked beat list: `offset + k * 60 / bpm` up to `duration`. */
  static grid(bpm: number, offset: number, duration: number): number[] {
    const step = 60 / Math.max(30, bpm);
    const out: number[] = [];
    for (let t = offset; t <= duration; t += step) out.push(t);
    return out;
  }

  get length(): number {
    return this.beats.length;
  }

  /** Index of the next beat not yet reported. */
  get next(): number {
    return this.index;
  }

  reset(): void {
    this.index = 0;
    this.lastTime = -Infinity;
  }

  /** Jump so that the next reported beat is the first one at or after `songTime`. */
  seek(songTime: number): void {
    this.index = lowerBound(this.beats, songTime);
    this.lastTime = songTime;
  }

  /**
   * Advance to `songTime`. Returns the strength of the strongest beat crossed since the last
   * call (0 when none). Several beats crossed in one frame (a stall) collapse into one pulse;
   * a beat more than `maxLag` seconds in the past is skipped silently rather than fired late.
   */
  poll(songTime: number, maxLag = 0.25): number {
    if (songTime < this.lastTime) this.seek(songTime);
    this.lastTime = songTime;
    let strength = 0;
    const b = this.beats;
    while (this.index < b.length && b[this.index] <= songTime) {
      if (songTime - b[this.index] <= maxLag) strength = Math.max(strength, BeatCursor.strengthOf(this.index));
      this.index++;
    }
    return strength;
  }

  static strengthOf(beatIndex: number): number {
    return beatIndex % BEATS_PER_BAR === 0 ? DOWNBEAT_STRENGTH : BEAT_STRENGTH;
  }

  /** 0 on a beat → 1 just before the next one (for beat-rate scrolling); 0 outside the list. */
  phase(songTime: number): number {
    const b = this.beats;
    if (b.length < 2) return 0;
    const i = Math.min(b.length - 2, Math.max(0, lowerBound(b, songTime) - 1));
    const span = b[i + 1] - b[i];
    if (span <= 0) return 0;
    const p = (songTime - b[i]) / span;
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }
}
