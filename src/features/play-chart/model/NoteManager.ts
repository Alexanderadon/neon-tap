import { CIRCLE_BUCKET, CIRCLE_HIT_WINDOWS, CIRCLE_OPEN_SHARE, HIT_WINDOWS, INPUT_SLOTS, type HitWindows } from '@/shared/config/constants';
import { judgeDelta, type Judgement } from '@/entities/score';
import type { NoteKind, ParsedNote } from '@/entities/chart';

export const enum NoteState {
  Pending = 0,
  Hit = 1,
  Missed = 2,
  /** Head was hit, tail still in progress (holds, rolls, slides). */
  Holding = 3,
  /** Tail judged. */
  Released = 4,
}

export interface PooledNote {
  time: number;
  lane: number;
  duration: number;
  endTime: number;
  kind: NoteKind | null;
  /** Circle group number (1-based) for kind === 'circle', else 0. */
  seq: number;
  /** Roll: required taps. Slide: end lane. */
  extra: number;
  /** Roll: taps registered so far. */
  taps: number;
  /** Lane count of the section this note belongs to (for rendering geometry). */
  lanes: number;
  state: NoteState;
  /** Head judgement, or `null` while pending. */
  judgement: Judgement | null;
  tailJudgement: Judgement | null;
  /** Signed timing error of the head hit, seconds (negative = early). */
  hitDelta: number;
  /** Touch assist: an early press was registered; the note is judged when it reaches the line. */
  armed: boolean;
  /** True when the judgement came from touch assist (its delta is synthetic — skip for auto-offset). */
  assisted: boolean;
  /** Crystal value carried by this (plain tap) note: 0 = none, 1 = gem, 5 = big gem. Set per run, kept across `reset()`. */
  gem: number;
}

export interface JudgeEvent {
  note: PooledNote;
  judgement: Judgement;
  /** True when this judgement is for a hold tail. */
  tail: boolean;
}

export interface NoteManagerOptions {
  /**
   * Touch assist: a press up to this many seconds before a note arms it, and it is judged
   * Great when it reaches the line. 0 = off.
   */
  assistWindow?: number;
  /** Note approach time in seconds — circles are open for the last CIRCLE_OPEN_SHARE of it. */
  approachTime?: number;
}

const POOL_SIZE = 2000;

/**
 * Object pool of notes + judgement logic. No allocations after `load()`.
 *
 * Notes are bucketed by input slot (lane, or the circle bucket) with a cursor to the next note
 * that can still be judged, so `press()` is O(1) amortised and `update()` only scans the few
 * notes near the current time.
 */
/** Circles get the wider windows; everything on the lanes keeps the tight ones. */
function windowsFor(note: { kind: string | null }): HitWindows {
  return note.kind === 'circle' ? CIRCLE_HIT_WINDOWS : HIT_WINDOWS;
}

export class NoteManager {
  readonly pool: PooledNote[] = [];
  count = 0;
  private readonly laneNotes: Int32Array[] = [];
  private readonly laneLen = new Int32Array(INPUT_SLOTS);
  private readonly laneCursor = new Int32Array(INPUT_SLOTS);
  /** Index of the first note that may still be on screen (advances monotonically). */
  firstActive = 0;
  onJudge: ((e: JudgeEvent) => void) | null = null;
  /** Extra tap registered on an active roll (for feedback). */
  onRollTap: ((note: PooledNote) => void) | null = null;
  readonly assistWindow: number;
  /** Seconds before a circle's moment from which a tap on it counts (at least as Good). */
  readonly circleEarly: number;

  constructor(capacity = POOL_SIZE, opts: NoteManagerOptions = {}) {
    this.assistWindow = opts.assistWindow ?? 0;
    this.circleEarly = Math.max(CIRCLE_HIT_WINDOWS.good, (opts.approachTime ?? 0) * CIRCLE_OPEN_SHARE);
    for (let i = 0; i < capacity; i++) {
      this.pool.push({
        time: 0,
        lane: 0,
        duration: 0,
        endTime: 0,
        kind: null,
        seq: 0,
        extra: 0,
        taps: 0,
        lanes: 4,
        state: NoteState.Pending,
        judgement: null,
        tailJudgement: null,
        hitDelta: 0,
        armed: false,
        assisted: false,
        gem: 0,
      });
    }
    for (let l = 0; l < INPUT_SLOTS; l++) this.laneNotes.push(new Int32Array(capacity));
  }

  load(notes: readonly ParsedNote[]): void {
    if (notes.length > this.pool.length) throw new Error(`chart has ${notes.length} notes, pool holds ${this.pool.length}`);
    this.count = notes.length;
    this.laneLen.fill(0);
    this.laneCursor.fill(0);
    this.firstActive = 0;
    for (let i = 0; i < notes.length; i++) {
      const src = notes[i];
      const n = this.pool[i];
      n.time = src.time;
      n.lane = src.lane;
      n.duration = src.duration;
      n.endTime = src.time + src.duration;
      n.kind = src.kind;
      n.seq = src.seq;
      n.extra = src.extra;
      n.taps = 0;
      n.lanes = src.lanes;
      n.state = NoteState.Pending;
      n.judgement = null;
      n.tailJudgement = null;
      n.hitDelta = 0;
      n.armed = false;
      n.assisted = false;
      n.gem = 0;
      // Circles are hit by tapping them (or Space), so they live in their own input bucket.
      const bucket = src.kind === 'circle' ? CIRCLE_BUCKET : src.lane;
      this.laneNotes[bucket][this.laneLen[bucket]++] = i;
    }
  }

  reset(): void {
    for (let i = 0; i < this.count; i++) {
      const n = this.pool[i];
      n.state = NoteState.Pending;
      n.judgement = null;
      n.tailJudgement = null;
      n.hitDelta = 0;
      n.taps = 0;
      n.armed = false;
      n.assisted = false;
    }
    this.laneCursor.fill(0);
    this.firstActive = 0;
  }

  /**
   * Mark this run's crystals: `picks` are indexes into the loaded (sorted) note list with the
   * crystal value each carries. Every other note is cleared. Judgement is untouched — a gem is a
   * plain tap that happens to pay out when hit.
   */
  setGems(picks: readonly { index: number; value: number }[]): void {
    for (let i = 0; i < this.count; i++) this.pool[i].gem = 0;
    for (const p of picks) if (p.index >= 0 && p.index < this.count) this.pool[p.index].gem = p.value;
  }

  get lastTime(): number {
    let t = 0;
    for (let i = 0; i < this.count; i++) t = Math.max(t, this.pool[i].endTime);
    return t;
  }

  /** Advance time: auto-miss overdue notes, fire armed notes, complete holds / rolls / slides. */
  update(songTime: number, isHeld: (lane: number) => boolean): void {
    for (let lane = 0; lane < INPUT_SLOTS; lane++) {
      const list = this.laneNotes[lane];
      const len = this.laneLen[lane];
      let cursor = this.laneCursor[lane];
      while (cursor < len) {
        const note = this.pool[list[cursor]];
        if (note.state === NoteState.Pending) {
          const w = windowsFor(note);
          if (note.armed && songTime >= note.time - w.great) {
            note.assisted = true;
            this.hit(note, 'great', -w.great);
            continue;
          }
          if (songTime - note.time > w.good) {
            note.state = NoteState.Missed;
            note.judgement = 'miss';
            this.emit(note, 'miss', false);
            if (note.duration > 0) {
              note.tailJudgement = 'miss';
              this.emit(note, 'miss', true);
            }
            cursor++;
            continue;
          }
          break; // future note — nothing more to do in this lane
        }
        if (note.state === NoteState.Holding) {
          if (songTime >= note.endTime) {
            this.finishHold(note, this.tailJudgement(note, isHeld));
            cursor++;
            continue;
          }
          break;
        }
        cursor++; // Hit / Missed / Released → skip
      }
      this.laneCursor[lane] = cursor;
    }
    while (this.firstActive < this.count) {
      const n = this.pool[this.firstActive];
      if (n.state !== NoteState.Pending && n.state !== NoteState.Holding && songTime - n.endTime > 0.5) this.firstActive++;
      else break;
    }
  }

  /** Tail verdict when a hold-type note reaches its end. */
  private tailJudgement(note: PooledNote, isHeld: (lane: number) => boolean): Judgement {
    if (note.kind === 'roll') return note.taps >= note.extra ? 'perfect' : note.taps >= Math.ceil(note.extra / 2) ? 'good' : 'miss';
    if (note.kind === 'slide') return isHeld(note.extra) ? (note.judgement ?? 'perfect') : 'miss';
    return note.judgement ?? 'perfect';
  }

  /** Player pressed input slot `bucket` at `songTime`. Returns the judgement, or null when no note was in range. */
  press(bucket: number, songTime: number): Judgement | null {
    const list = this.laneNotes[bucket];
    const len = this.laneLen[bucket];
    for (let i = this.laneCursor[bucket]; i < len; i++) {
      const note = this.pool[list[i]];
      if (note.state === NoteState.Holding && note.kind === 'roll') {
        // Extra tap on an active roll.
        if (songTime <= note.endTime + HIT_WINDOWS.good) {
          note.taps++;
          this.onRollTap?.(note);
          return null;
        }
        continue;
      }
      if (note.state !== NoteState.Pending) continue;
      const delta = songTime - note.time;
      const w = windowsFor(note);
      const early = note.kind === 'circle' ? this.circleEarly : w.good;
      if (delta < -early) {
        if (this.assistWindow > 0 && -delta <= this.assistWindow && !note.armed) note.armed = true;
        return null;
      }
      const j = judgeDelta(delta, w, early);
      if (!j) continue; // overdue note — update() will miss it
      this.hit(note, j, delta);
      return j;
    }
    return null;
  }

  /** Player released input slot `bucket`. Matters for holds (break) and slides (arrive in the end lane). */
  release(bucket: number, songTime: number): void {
    // Slides end in another lane: a release there within the window is the tail hit.
    for (let i = this.firstActive; i < this.count; i++) {
      const n = this.pool[i];
      if (n.state !== NoteState.Holding || n.kind !== 'slide' || n.extra !== bucket) continue;
      const delta = songTime - n.endTime;
      const j = judgeDelta(delta);
      if (j && delta <= HIT_WINDOWS.good) this.finishHold(n, j);
      return;
    }
    const list = this.laneNotes[bucket];
    const len = this.laneLen[bucket];
    for (let i = this.laneCursor[bucket]; i < len; i++) {
      const note = this.pool[list[i]];
      if (note.state !== NoteState.Holding) {
        if (note.state === NoteState.Pending) return;
        continue;
      }
      if (note.kind === 'roll' || note.kind === 'slide') continue; // rolls: taps decide; slides: judged in the end lane
      const delta = songTime - note.endTime;
      const j = judgeDelta(delta);
      // Released early → tail broken; within the window → judged like a tap.
      this.finishHold(note, j && delta <= HIT_WINDOWS.good ? j : 'miss');
      return;
    }
  }

  private hit(note: PooledNote, j: Judgement, delta: number): void {
    note.hitDelta = delta;
    note.judgement = j;
    note.armed = false;
    note.taps = 1;
    note.state = note.duration > 0 ? NoteState.Holding : NoteState.Hit;
    this.emit(note, j, false);
  }

  private finishHold(note: PooledNote, j: Judgement): void {
    note.state = NoteState.Released;
    note.tailJudgement = j;
    this.emit(note, j, true);
  }

  private emit(note: PooledNote, judgement: Judgement, tail: boolean): void {
    this.onJudge?.({ note, judgement, tail });
  }
}
