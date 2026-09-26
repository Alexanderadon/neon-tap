import { MAX_LANES } from '@/shared/config/constants';
import { lowerBound, median } from '@/shared/lib/math';
import type { NoteKind } from '@/shared/types/chart';

/**
 * The wide latency probe (review 26.09, «Доделать» 2). Without calibration, Safari reports no
 * output latency and Bluetooth adds 150–250 ms: every tap lands outside the hit windows, so the
 * in-run learner (hits within ±150 ms only) never gets a sample and the first run fails at 0:03.
 * The probe takes every press within ±300 ms of a note of its lane — one press per note, given to the
 * earliest note in reach that has not had one yet — and once there are PROBE_MIN_SAMPLES of them that
 * agree (median absolute deviation ≤ PROBE_MAX_MAD) their median is the player's offset.
 *
 * - `single-lane`: only notes of single-lane sections (the tutorial's first steps — a press there
 *   can only mean that one lane's note).
 * - `all-lanes`: notes of every section, but only plain taps / holds whose lane neighbours are far
 *   enough apart that a press cannot be taken for the neighbour's (a normal run while the offset is
 *   still unsettled; empty presses count too — they are what a lagging player produces).
 */
export type OffsetProbeMode = 'single-lane' | 'all-lanes';

export interface ProbeNote {
  time: number;
  lane: number;
  lanes: number;
  kind: NoteKind | null;
}

/** A press this far (real seconds) from a note of its lane still says something about the player's timing. */
export const PROBE_WINDOW = 0.3;
export const PROBE_MIN_SAMPLES = 8;
/** Samples agree when their median absolute deviation is at most this (seconds). */
export const PROBE_MAX_MAD = 0.06;
/** The newest this many samples are kept. */
export const PROBE_MAX_SAMPLES = 32;
/**
 * `all-lanes`: a note counts only when its lane neighbours are at least this many windows away (song
 * seconds) — two windows and a margin for the faster levels — so a lagging press is never taken for
 * the next note's early one.
 */
const ISOLATION = 2.5;

export class OffsetProbe {
  /** Per lane: the note indexes in time order and their times (every kind — a press near any note belongs to it). */
  private readonly laneIdx: number[][] = [];
  private readonly laneTimes: Float64Array[] = [];
  private readonly eligible: Uint8Array;
  private readonly taken: Uint8Array;
  private readonly samples: number[] = [];

  constructor(
    notes: readonly ProbeNote[],
    readonly mode: OffsetProbeMode,
    private readonly window = PROBE_WINDOW,
  ) {
    this.eligible = new Uint8Array(notes.length);
    this.taken = new Uint8Array(notes.length);
    const lists: number[][] = Array.from({ length: MAX_LANES }, () => []);
    notes.forEach((n, i) => {
      if (n.kind !== 'circle' && n.kind !== 'spin' && n.lane >= 0 && n.lane < MAX_LANES) lists[n.lane].push(i);
    });
    for (const list of lists) {
      list.sort((a, b) => notes[a].time - notes[b].time);
      const times = Float64Array.from(list, (i) => notes[i].time);
      list.forEach((i, k) => {
        const n = notes[i];
        if (n.kind !== null) return; // plain taps and holds only: slides, rolls and spells have their own reasons to be pressed
        if (mode === 'single-lane') this.eligible[i] = n.lanes === 1 ? 1 : 0;
        else {
          // A neighbour this close could claim the press: the note is left out.
          const before = k > 0 ? n.time - times[k - 1] : Infinity;
          const after = k + 1 < times.length ? times[k + 1] - n.time : Infinity;
          this.eligible[i] = Math.min(before, after) >= ISOLATION * this.window ? 1 : 0;
        }
      });
      this.laneIdx.push(list);
      this.laneTimes.push(times);
    }
  }

  /** The same notes come round again (a restart, the next level): each may give a sample once more; the samples stay. */
  rearm(): void {
    this.taken.fill(0);
  }

  /**
   * A press in `lane` at judgement song time `t`: `rate` — song seconds per real second at that moment,
   * `offset` — the tap offset in effect then (real seconds, what `t` was computed with). Returns true
   * when it became a sample: the offset that would have put this press on its note.
   */
  press(lane: number, t: number, rate: number, offset: number): boolean {
    if (lane < 0 || lane >= MAX_LANES) return false;
    const times = this.laneTimes[lane];
    const idx = this.laneIdx[lane];
    const r = Math.max(0.1, rate);
    const span = this.window * r;
    // The earliest note in reach that has not given a sample yet: with taps half a second apart a press
    // 260 ms late is nearer the next tile, but it is this one's — the one before took its own press.
    let k = lowerBound(times, t - span);
    while (k < times.length && times[k] <= t + span && this.taken[idx[k]]) k++;
    if (k >= times.length || times[k] > t + span || !this.eligible[idx[k]]) return false;
    this.taken[idx[k]] = 1;
    this.samples.push(offset + (t - times[k]) / r);
    if (this.samples.length > PROBE_MAX_SAMPLES) this.samples.shift();
    return true;
  }

  get count(): number {
    return this.samples.length;
  }

  /** The player's offset (real seconds) once enough samples agree; null until then. */
  settled(): number | null {
    if (this.samples.length < PROBE_MIN_SAMPLES) return null;
    const m = median(this.samples);
    const mad = median(this.samples.map((s) => Math.abs(s - m)));
    return mad <= PROBE_MAX_MAD ? m : null;
  }
}
