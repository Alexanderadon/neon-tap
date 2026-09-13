import { lanesAt, snapToGrid, slotTime, type NoteTuple, type Section } from '@/entities/chart';

/** A press shorter than this many grid slots is a tap; longer, a hold. */
const HOLD_MIN_SLOTS = 2;

interface Contact {
  lane: number;
  slot: number;
}

/**
 * The editor's ear: the player taps the rhythm they hear and every tap becomes a tile on the
 * nearest sixteenth of the tracked beat grid; a press held for two slots or more becomes a hold
 * that ends on the grid too. Two taps on one slot in different lanes are a chord; a second tap on
 * the same slot and lane is ignored. Pure: the session feeds it song times.
 */
export class Recorder {
  private readonly contacts = new Map<number, Contact>();
  private readonly notes: NoteTuple[] = [];

  constructor(
    private readonly beats: readonly number[],
    private readonly sections: readonly Section[],
  ) {}

  /** Finger down in `lane` at song time `t`. Ignored outside the section's lanes. */
  press(lane: number, t: number): void {
    const { slot } = snapToGrid(this.beats, t);
    if (lane < 0 || lane >= lanesAt(this.sections, slotTime(this.beats, slot))) return;
    this.contacts.set(lane, { lane, slot });
  }

  /** Finger up in `lane` at song time `t`: the note is committed. Returns it, or null. */
  release(lane: number, t: number): NoteTuple | null {
    const c = this.contacts.get(lane);
    if (!c) return null;
    this.contacts.delete(lane);
    const start = slotTime(this.beats, c.slot);
    if (this.notes.some((n) => n[0] === start && n[1] === lane)) return null;
    const endSlot = snapToGrid(this.beats, t).slot;
    const len = endSlot - c.slot;
    const note: NoteTuple = len >= HOLD_MIN_SLOTS ? [start, lane, Math.round((slotTime(this.beats, endSlot) - start) * 1000) / 1000] : [start, lane];
    this.notes.push(note);
    this.notes.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return note;
  }

  /** Fingers still down (a pause, a stop): committed as taps at their press slot. */
  releaseAll(): void {
    for (const c of [...this.contacts.values()]) this.release(c.lane, slotTime(this.beats, c.slot));
  }

  /** Everything recorded so far, sorted. */
  get recorded(): readonly NoteTuple[] {
    return this.notes;
  }

  clear(): void {
    this.contacts.clear();
    this.notes.length = 0;
  }
}

/**
 * The chart being edited: the current notes, a history for undo, and the one operation the
 * editor needs — replace everything in a time range with what was just recorded.
 */
export class EditorDraft {
  private history: NoteTuple[][] = [];

  constructor(public notes: NoteTuple[]) {}

  /** Replace the notes starting in [from, to) with `recorded` (any of them outside the range are kept out). */
  replaceRange(from: number, to: number, recorded: readonly NoteTuple[]): void {
    this.history.push(this.notes);
    const kept = this.notes.filter((n) => n[0] < from - 1e-6 || n[0] >= to - 1e-6);
    const fresh = recorded.filter((n) => n[0] >= from - 1e-6 && n[0] < to - 1e-6);
    this.notes = [...kept, ...fresh].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }

  /** Remove every note starting in [from, to). */
  clearRange(from: number, to: number): void {
    this.replaceRange(from, to, []);
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  undo(): boolean {
    const prev = this.history.pop();
    if (!prev) return false;
    this.notes = prev;
    return true;
  }
}
