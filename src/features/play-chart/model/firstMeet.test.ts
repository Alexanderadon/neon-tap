import { describe, expect, it } from 'vitest';
import type { NoteKind } from '@/shared/types/chart';
import { MEET_MIN_SEC, MeetTracker, planMeetings, type MeetNote } from './firstMeet';

const note = (time: number, kind: NoteKind | null, duration = 0, extra = 0): MeetNote => ({ time, duration, kind, lane: 1, lanes: 4, extra });
/** 120 BPM: a beat is half a second. */
const BEAT = 0.5;

describe('planMeetings', () => {
  it('owes a card for the first note of every kind not met yet, rising two beats ahead', () => {
    const notes = [note(2, null), note(10, 'slide', 1, 2), note(12, 'slide', 1, 0), note(20, 'roll', 1, 6), note(30, 'circle'), note(40, 'spin', 4)];
    const plan = planMeetings(notes, ['circle'], BEAT);
    expect(plan.map((m) => m.kind)).toEqual(['slide', 'roll', 'spin']);
    expect(plan[0]).toMatchObject({ at: 10, from: 9, extra: 2, lanes: 4, lane: 1 });
    // Up until two beats after the note ends, and at least MEET_MIN_SEC.
    expect(plan[0].to).toBe(9 + MEET_MIN_SEC);
    expect(plan[2].to).toBe(40 + 4 + 2 * BEAT);
  });

  it('owes nothing when every kind was met, or none is in the chart', () => {
    expect(planMeetings([note(10, 'slide', 1)], ['slide', 'roll', 'circle', 'spin'], BEAT)).toEqual([]);
    expect(planMeetings([note(1, null), note(2, 'slow'), note(3, 'heart')], [], BEAT)).toEqual([]);
  });

  it('comes in song order whatever the kind', () => {
    const plan = planMeetings([note(30, 'slide', 1), note(5, 'spin', 3)], [], BEAT);
    expect(plan.map((m) => m.kind)).toEqual(['spin', 'slide']);
  });
});

describe('MeetTracker', () => {
  const plan = planMeetings([note(10, 'slide', 1), note(30, 'roll', 1, 4)], [], BEAT);

  it('raises each card once for its window and takes it down after', () => {
    const t = new MeetTracker(plan);
    expect(t.update(5)).toBeUndefined();
    expect(t.update(9)?.kind).toBe('slide');
    expect(t.showing).toBe(true);
    expect(t.update(10)).toBeUndefined();
    expect(t.update(plan[0].to)).toBeNull();
    expect(t.showing).toBe(false);
    expect(t.update(29)?.kind).toBe('roll');
  });

  it('shows a kind once per session: a restart or the next level does not bring it back', () => {
    const t = new MeetTracker(plan);
    t.update(9.5);
    expect(t.clear()).toBe(true);
    expect(t.clear()).toBe(false);
    expect(t.update(9.5)).toBeUndefined();
    expect(t.update(10.5)).toBeUndefined();
  });

  it('keeps the card on screen through a rewind (resume goes back a second)', () => {
    const t = new MeetTracker(plan);
    t.update(9.2);
    expect(t.update(8.2)).toBeUndefined();
    expect(t.showing).toBe(true);
  });

  it('lets a later card cut an earlier one short', () => {
    const close = planMeetings([note(10, 'slide', 1), note(11.5, 'circle')], [], BEAT);
    const t = new MeetTracker(close);
    expect(t.update(9)?.kind).toBe('slide');
    expect(t.update(10.5)?.kind).toBe('circle');
    // The slide's window is still open, but its card was shown: nothing comes back when the circle's goes.
    expect(t.update(close[1].to)).toBeNull();
  });
});
