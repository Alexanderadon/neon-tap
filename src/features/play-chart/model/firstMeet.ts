import type { NoteKind } from '@/shared/types/chart';
import { MEET_KINDS, type MeetKind } from '@/entities/settings';

/**
 * The first meeting of a mechanic (review 26.09, «Доделать» 5). The tutorial teaches taps and holds;
 * a slide, a roll, a circle or a spinner is explained in the run itself: the tutorial's caption card
 * rises two beats before the first note of a kind the player has never met, stays until two beats
 * after it (at least MEET_MIN_SEC), and is never shown again (`settings.seenKinds`). The song keeps
 * playing — no pause, no button.
 */
export interface MeetNote {
  time: number;
  duration: number;
  kind: NoteKind | null;
  lane: number;
  lanes: number;
  /** Slide: the end lane. Roll: the taps. */
  extra: number;
}

export interface Meeting {
  kind: MeetKind;
  /** The note it introduces: its lane geometry, lane, end lane / taps and time (song seconds). */
  lanes: number;
  lane: number;
  extra: number;
  at: number;
  /** The card is up from `from` to `to` (song seconds). */
  from: number;
  to: number;
}

/** The card rises this many beats before the note lands. */
export const MEET_LEAD_BEATS = 2;
/** …and goes this many beats after the note ends, but never before it has been up MEET_MIN_SEC. */
export const MEET_TAIL_BEATS = 2;
export const MEET_MIN_SEC = 3;

/** The cards a run owes the player: the first note of every kind not met yet, in the order they come. */
export function planMeetings(notes: readonly MeetNote[], seen: readonly string[], beatSec: number): Meeting[] {
  const plan: Meeting[] = [];
  for (const kind of MEET_KINDS) {
    if (seen.includes(kind)) continue;
    const n = notes.find((x) => x.kind === kind);
    if (!n) continue;
    const from = n.time - MEET_LEAD_BEATS * beatSec;
    const to = Math.max(n.time + n.duration + MEET_TAIL_BEATS * beatSec, from + MEET_MIN_SEC);
    plan.push({ kind, lanes: n.lanes, lane: n.lane, extra: n.extra, at: n.time, from, to });
  }
  return plan.sort((a, b) => a.from - b.from);
}

/**
 * Which card is up as the song plays: once per kind for the whole session (a restart or the next level
 * does not bring a card back), a later card cuts an earlier one short, and a rewind (resume and revive
 * go back a second) never takes the card on screen away.
 */
export class MeetTracker {
  private readonly shown = new Set<MeetKind>();
  private cur = -1;

  constructor(readonly plan: readonly Meeting[]) {}

  /** The song is at `t`: the card that rises now, null when the card goes, undefined when nothing changes. */
  update(t: number): Meeting | null | undefined {
    let next = -1;
    for (let i = 0; i < this.plan.length; i++) {
      const m = this.plan[i];
      if (i === this.cur) {
        if (t < m.to) next = i;
      } else if (!this.shown.has(m.kind) && m.from <= t && t < m.to) next = i;
    }
    if (next === this.cur) return undefined;
    this.cur = next;
    if (next < 0) return null;
    this.shown.add(this.plan[next].kind);
    return this.plan[next];
  }

  /** A new pass (restart, next level): the card on screen goes, the kinds shown stay shown. True when a card was up. */
  clear(): boolean {
    const had = this.cur >= 0;
    this.cur = -1;
    return had;
  }

  get showing(): boolean {
    return this.cur >= 0;
  }
}
