import { HIT_WINDOWS, LANE_COUNT } from '@/shared/config/constants';
import { judgeDelta, type Judgement } from '@/entities/score';
import type { ParsedNote } from '@/entities/chart';

export const enum NoteState {
  Pending = 0,
  Hit = 1,
  Missed = 2,
  /** Head was hit, tail still in progress. */
  Holding = 3,
  /** Hold finished (tail judged). */
  Released = 4,
}

export interface PooledNote {
  time: number;
  lane: number;
  duration: number;
  endTime: number;
  state: NoteState;
  /** Head judgement, or `null` while pending. */
  judgement: Judgement | null;
  tailJudgement: Judgement | null;
  /** Signed timing error of the head hit, seconds (negative = early). */
  hitDelta: number;
}

export interface JudgeEvent {
  note: PooledNote;
  judgement: Judgement;
  /** True when this judgement is for a hold tail. */
  tail: boolean;
}

const POOL_SIZE = 2000;

/**
 * Object pool of notes + judgement logic. No allocations after `load()`.
 *
 * Per lane we keep a cursor to the next note that can still be judged, so `press()` is O(1)
 * amortised, and `update()` only scans the few notes near the current time.
 */
export class NoteManager {
  readonly pool: PooledNote[] = [];
  count = 0;
  /** Per-lane list of pool indices in time order. */
  private readonly laneNotes: Int32Array[] = [];
  private readonly laneLen = new Int32Array(LANE_COUNT);
  private readonly laneCursor = new Int32Array(LANE_COUNT);
  /** Index of the first note that may still be on screen (advances monotonically). */
  firstActive = 0;
  onJudge: ((e: JudgeEvent) => void) | null = null;

  constructor(capacity = POOL_SIZE) {
    for (let i = 0; i < capacity; i++) {
      this.pool.push({ time: 0, lane: 0, duration: 0, endTime: 0, state: NoteState.Pending, judgement: null, tailJudgement: null, hitDelta: 0 });
    }
    for (let l = 0; l < LANE_COUNT; l++) this.laneNotes.push(new Int32Array(capacity));
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
      n.state = NoteState.Pending;
      n.judgement = null;
      n.tailJudgement = null;
      n.hitDelta = 0;
      const lane = src.lane;
      this.laneNotes[lane][this.laneLen[lane]++] = i;
    }
  }

  reset(): void {
    for (let i = 0; i < this.count; i++) {
      const n = this.pool[i];
      n.state = NoteState.Pending;
      n.judgement = null;
      n.tailJudgement = null;
      n.hitDelta = 0;
    }
    this.laneCursor.fill(0);
    this.firstActive = 0;
  }

  get lastTime(): number {
    let t = 0;
    for (let i = 0; i < this.count; i++) t = Math.max(t, this.pool[i].endTime);
    return t;
  }

  /** Advance time: auto-miss overdue notes, complete holds that are still held. */
  update(songTime: number, isHeld: (lane: number) => boolean): void {
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const list = this.laneNotes[lane];
      const len = this.laneLen[lane];
      let cursor = this.laneCursor[lane];
      while (cursor < len) {
        const note = this.pool[list[cursor]];
        if (note.state === NoteState.Pending) {
          if (songTime - note.time > HIT_WINDOWS.good) {
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
            // Held to the end (or release came within the window and was handled by release()).
            const j: Judgement = isHeld(lane) ? (note.judgement ?? 'perfect') : 'perfect';
            this.finishHold(note, j);
            cursor++;
            continue;
          }
          break;
        }
        cursor++; // Hit / Missed / Released → skip
      }
      this.laneCursor[lane] = cursor;
    }
    // Slide the render window start past notes that are long gone.
    while (this.firstActive < this.count) {
      const n = this.pool[this.firstActive];
      if (n.state !== NoteState.Pending && n.state !== NoteState.Holding && songTime - n.endTime > 0.5) this.firstActive++;
      else break;
    }
  }

  /** Player pressed `lane` at `songTime`. Returns the judgement, or null when no note was in range. */
  press(lane: number, songTime: number): Judgement | null {
    const list = this.laneNotes[lane];
    const len = this.laneLen[lane];
    for (let i = this.laneCursor[lane]; i < len; i++) {
      const note = this.pool[list[i]];
      if (note.state !== NoteState.Pending) continue;
      const delta = songTime - note.time;
      if (delta < -HIT_WINDOWS.good) return null; // next note is too far in the future
      const j = judgeDelta(delta);
      if (!j) continue; // overdue note — update() will miss it
      note.hitDelta = delta;
      note.judgement = j;
      note.state = note.duration > 0 ? NoteState.Holding : NoteState.Hit;
      this.emit(note, j, false);
      return j;
    }
    return null;
  }

  /** Player released `lane`. Only matters for holds. */
  release(lane: number, songTime: number): void {
    const list = this.laneNotes[lane];
    const len = this.laneLen[lane];
    for (let i = this.laneCursor[lane]; i < len; i++) {
      const note = this.pool[list[i]];
      if (note.state !== NoteState.Holding) {
        if (note.state === NoteState.Pending) return;
        continue;
      }
      const delta = songTime - note.endTime;
      const j = judgeDelta(delta);
      // Released early → tail broken; within the window → judged like a tap.
      this.finishHold(note, j && delta <= HIT_WINDOWS.good ? j : 'miss');
      return;
    }
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
