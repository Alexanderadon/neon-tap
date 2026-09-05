import type { Judgement, ResultTimeline } from '@/shared/types/result';

/** Judgement ↔ byte code used by the typed-array recorder. */
export const JUDGEMENT_CODES: readonly Judgement[] = ['perfect', 'great', 'good', 'miss'];

/**
 * Records every judgement of a run without allocating in the game loop: three typed arrays
 * preallocated to the chart's judgement count (see `countJudgements`). Time is stored in
 * centiseconds, combo as a 16-bit value. `toResult()` converts once at the end of the run.
 */
export class JudgementTimeline {
  private readonly times: Uint32Array;
  private readonly judgements: Uint8Array;
  private readonly combos: Uint16Array;
  private length = 0;

  constructor(capacity: number) {
    const n = Math.max(0, capacity | 0);
    this.times = new Uint32Array(n);
    this.judgements = new Uint8Array(n);
    this.combos = new Uint16Array(n);
  }

  get count(): number {
    return this.length;
  }

  get capacity(): number {
    return this.times.length;
  }

  reset(): void {
    this.length = 0;
  }

  /** Append one judgement. Silently drops entries beyond capacity (never throws mid-run). */
  record(songTime: number, judgement: Judgement, combo: number): void {
    const i = this.length;
    if (i >= this.times.length) return;
    const cs = Math.round(songTime * 100);
    this.times[i] = cs > 0 ? (cs > 0xffffffff ? 0xffffffff : cs) : 0;
    this.judgements[i] = JUDGEMENT_CODES.indexOf(judgement);
    this.combos[i] = combo > 0xffff ? 0xffff : combo < 0 ? 0 : combo;
    this.length = i + 1;
  }

  /** Materialise plain arrays for `PlayResult` (one allocation per array, done once at finish). */
  toResult(): ResultTimeline {
    const n = this.length;
    const t = new Array<number>(n);
    const j = new Array<Judgement>(n);
    const combo = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      t[i] = this.times[i] / 100;
      j[i] = JUDGEMENT_CODES[this.judgements[i]];
      combo[i] = this.combos[i];
    }
    return { t, j, combo };
  }
}
