import { describe, expect, it } from 'vitest';
import type { NoteKind } from '@/entities/chart';
import { NoteManager, NoteState, spinJudgement, type JudgeEvent } from './NoteManager';
import { SPIN_BUCKET, SPIN_REV_PER_SEC } from '@/shared/config/constants';

type Spec = [number, number, number?, NoteKind?, number?];

function make(notes: Spec[], assistWindow = 0) {
  const nm = new NoteManager(50, { assistWindow });
  const events: JudgeEvent[] = [];
  nm.onJudge = (e) => events.push(e);
  nm.load(notes.map(([time, lane, duration = 0, kind = null, extra = 0]) => ({ time, lane, duration, kind, seq: 0, extra, lanes: 4 })));
  return { nm, events };
}

const notHeld = () => false;
const held = () => true;

describe('NoteManager', () => {
  it('judges taps by the windows: 0.030 → perfect, 0.080 → great, 0.200 → miss', () => {
    const { nm, events } = make([
      [1, 0],
      [2, 1],
      [3, 2],
    ]);
    expect(nm.press(0, 1.03)).toBe('perfect');
    expect(nm.press(1, 2.08)).toBe('great');
    expect(nm.press(2, 3.2)).toBeNull();
    nm.update(3.2, notHeld);
    expect(events.map((e) => e.judgement)).toEqual(['perfect', 'great', 'miss']);
    expect(nm.pool[2].state).toBe(NoteState.Missed);
  });

  it('ignores presses when the next note is far in the future', () => {
    const { nm, events } = make([[5, 0]]);
    expect(nm.press(0, 1)).toBeNull();
    expect(events).toHaveLength(0);
  });

  it('judges the earliest pending note in the lane', () => {
    const { nm } = make([
      [1, 0],
      [1.1, 0],
    ]);
    expect(nm.press(0, 1.04)).toBe('perfect');
    expect(nm.pool[0].state).toBe(NoteState.Hit);
    expect(nm.pool[1].state).toBe(NoteState.Pending);
  });

  it('handles holds: head + tail judgements', () => {
    const { nm, events } = make([[1, 3, 1]]);
    expect(nm.press(3, 1.0)).toBe('perfect');
    nm.update(1.5, held);
    expect(nm.pool[0].state).toBe(NoteState.Holding);
    nm.update(2.0, held);
    expect(nm.pool[0].state).toBe(NoteState.Released);
    expect(events.map((e) => [e.judgement, e.tail])).toEqual([
      ['perfect', false],
      ['perfect', true],
    ]);
  });

  it('keeps the windows real seconds on a faster level (timeScale = playback rate)', () => {
    const { nm, events } = make([[1, 0]]);
    nm.timeScale = 1.2; // ×1.2 level: 0.17 song-seconds late is 0.142 real seconds — inside Good (0.15 s)
    expect(nm.press(0, 1.17)).toBe('good');
    const late = make([[1, 0]]);
    expect(late.nm.press(0, 1.17)).toBeNull(); // the same lateness at ×1 is outside the window
    late.nm.update(1.3, notHeld);
    expect(events[0].judgement).toBe('good');
    expect(late.events[0].judgement).toBe('miss');
  });

  it('grades a hold released too early as Good (the head was hit, so never a miss)', () => {
    const { nm, events } = make([[1, 3, 1]]);
    nm.press(3, 1.0);
    nm.release(3, 1.4);
    expect(events[1]).toMatchObject({ judgement: 'good', tail: true });
  });

  it('misses both head and tail of an untouched hold', () => {
    const { nm, events } = make([[1, 0, 0.5]]);
    nm.update(1.2, notHeld);
    expect(events.map((e) => e.judgement)).toEqual(['miss', 'miss']);
  });

  it('reset restores pending state', () => {
    const { nm } = make([[1, 0]]);
    nm.press(0, 1);
    nm.reset();
    expect(nm.pool[0].state).toBe(NoteState.Pending);
    expect(nm.press(0, 1)).toBe('perfect');
  });

  describe('touch assist', () => {
    it('arms an early press and judges Great at the note moment, never before the sound', () => {
      const { nm, events } = make([[1, 0]], 0.4);
      expect(nm.press(0, 0.7)).toBeNull();
      nm.update(0.95, notHeld);
      expect(nm.pool[0].state).toBe(NoteState.Pending);
      nm.update(1.0, notHeld);
      expect(nm.pool[0].state).toBe(NoteState.Hit);
      expect(events).toEqual([expect.objectContaining({ judgement: 'great', tail: false })]);
    });

    it('never arms a long note (a hold needs a finger) and a second early press keeps the arm', () => {
      const { nm } = make(
        [
          [1, 0, 0.5],
          [3, 1],
        ],
        0.4,
      );
      expect(nm.press(0, 0.7)).toBeNull();
      expect(nm.pool[0].armed).toBe(false);
      expect(nm.press(1, 2.7)).toBeNull();
      expect(nm.pool[1].armed).toBe(true);
      expect(nm.press(1, 2.75)).toBeNull();
      expect(nm.pool[1].armed).toBe(true);
    });

    it('is off by default (desktop keeps strict timing)', () => {
      const { nm } = make([[1, 0]]);
      nm.press(0, 0.7);
      nm.update(0.95, notHeld);
      expect(nm.pool[0].state).toBe(NoteState.Pending);
    });
  });

  describe('circles', () => {
    it('are hit only from the circle bucket, never by lane keys', () => {
      const { nm, events } = make([[1, 2, 0, 'circle']]);
      expect(nm.press(2, 1.0)).toBeNull();
      expect(nm.pool[0].state).toBe(NoteState.Pending);
      expect(nm.press(7, 1.02)).toBe('perfect');
      expect(events).toHaveLength(1);
    });

    it('get almost twice the time of a lane note: 0.25 s late is still good, 0.30 s is a miss', () => {
      const lane = make([[1, 2]]);
      lane.nm.update(1.25, notHeld);
      expect(lane.nm.press(2, 1.25)).toBeNull(); // a lane note is long gone at 0.25 s
      const c = make([
        [1, 2, 0, 'circle'],
        [2, 0, 0, 'circle'],
      ]);
      c.nm.update(1.25, notHeld);
      expect(c.nm.pool[0].state).toBe(NoteState.Pending);
      expect(c.nm.press(7, 1.25)).toBe('good');
      expect(c.nm.press(7, 1.85)).toBe('great'); // 0.15 s early on the next one
      const late = make([[1, 2, 0, 'circle']]);
      late.nm.update(1.3, notHeld);
      expect(late.nm.pool[0].state).toBe(NoteState.Missed);
    });

    it('are open for the last half of their approach: any tap while the ring is closing counts as good', () => {
      const nm = new NoteManager(50, { approachTime: 2 }); // circles open 1.0 s early
      nm.load([
        { time: 3, lane: 1, duration: 0, kind: 'circle', seq: 1, extra: 0, lanes: 4 },
        { time: 6, lane: 2, duration: 0, kind: 'circle', seq: 2, extra: 0, lanes: 4 },
      ]);
      expect(nm.press(7, 1.9)).toBeNull(); // 1.1 s early: the ring is still wide, nothing happens
      expect(nm.pool[0].state).toBe(NoteState.Pending);
      expect(nm.press(7, 2.2)).toBe('good'); // 0.8 s early: open
      expect(nm.press(7, 5.85)).toBe('great'); // 0.15 s early on the next one: the usual windows still grade
      // lane notes never get the wide lead
      const lane = new NoteManager(50, { approachTime: 2 });
      lane.load([{ time: 3, lane: 1, duration: 0, kind: null, seq: 0, extra: 0, lanes: 4 }]);
      expect(lane.press(1, 2.2)).toBeNull();
    });
  });

  describe('rolls', () => {
    it('count taps during the roll and grade the tail by count', () => {
      const { nm, events } = make([[1, 1, 1, 'roll', 4]]);
      expect(nm.press(1, 1.0)).toBe('perfect'); // head = tap 1
      nm.release(1, 1.1);
      nm.press(1, 1.3);
      nm.release(1, 1.35);
      nm.press(1, 1.6);
      nm.update(1.7, notHeld);
      expect(nm.pool[0].state).toBe(NoteState.Holding);
      nm.update(2.0, notHeld);
      expect(nm.pool[0].taps).toBe(3);
      expect(events[1]).toMatchObject({ judgement: 'great', tail: true }); // 3 of 4 → great; fewer than half → good, never a miss
    });

    it('is perfect when all taps land', () => {
      const { nm, events } = make([[1, 1, 1, 'roll', 3]]);
      nm.press(1, 1.0);
      nm.press(1, 1.3);
      nm.press(1, 1.6);
      nm.update(2.0, notHeld);
      expect(events[1]).toMatchObject({ judgement: 'perfect', tail: true });
    });
  });

  describe('slides', () => {
    it('succeeds when the finger arrives in the end lane, ignoring the start-lane release', () => {
      const { nm, events } = make([[1, 0, 1, 'slide', 2]]);
      expect(nm.press(0, 1.0)).toBe('perfect');
      nm.release(0, 1.4); // finger slid away — not a break
      expect(nm.pool[0].state).toBe(NoteState.Holding);
      nm.update(2.0, (lane) => lane === 2);
      expect(events[1]).toMatchObject({ judgement: 'perfect', tail: true });
    });

    it('grades a slide as Good when nothing is held in the end lane at the end', () => {
      const { nm, events } = make([[1, 0, 1, 'slide', 2]]);
      nm.press(0, 1.0);
      nm.update(2.0, notHeld);
      expect(events[1]).toMatchObject({ judgement: 'good', tail: true });
    });

    it('accepts a release in the end lane within the window', () => {
      const { nm, events } = make([[1, 0, 1, 'slide', 3]]);
      nm.press(0, 1.0);
      nm.release(3, 1.96);
      expect(events[1]).toMatchObject({ judgement: 'perfect', tail: true });
    });
  });

  describe('spinners', () => {
    it('start on their own, are turned rather than pressed, and are judged once at the end by revolutions', () => {
      const { nm, events } = make([
        [1, 0],
        [3, 0, 2, 'spin'],
        [6, 1],
      ]);
      const spin = nm.pool[1];
      expect(spin.extra).toBe(Math.round(2 * SPIN_REV_PER_SEC));
      nm.update(2, notHeld);
      expect(spin.state).toBe(NoteState.Pending);
      expect(nm.activeSpin(2, 0.5)).toBeNull();
      expect(nm.activeSpin(2.8, 0.5)).toBe(spin); // about to start: the field is already cleared
      nm.update(3.1, notHeld);
      expect(spin.state).toBe(NoteState.Holding);
      expect(nm.activeSpin(3.1, 0.5)).toBe(spin);
      expect(nm.press(SPIN_BUCKET, 3.2)).toBeNull();
      spin.spin = spin.extra;
      nm.update(5.2, notHeld);
      expect(spin.state).toBe(NoteState.Released);
      expect(nm.activeSpin(5.2, 0.5)).toBeNull();
      // One judgement for the spinner (tail), plus the miss of the untouched first tap.
      expect(events.filter((e) => e.note === spin)).toEqual([{ note: spin, judgement: 'perfect', tail: true }]);
    });

    it('grades by the share of required revolutions and never by lane presses', () => {
      expect(spinJudgement(3, 3)).toBe('perfect');
      expect(spinJudgement(2.3, 3)).toBe('great');
      expect(spinJudgement(1.5, 3)).toBe('good');
      expect(spinJudgement(1.4, 3)).toBe('miss');
      const { nm, events } = make([[1, 0, 2, 'spin']]);
      nm.update(1.5, notHeld);
      expect(nm.press(0, 1.5)).toBeNull();
      nm.release(SPIN_BUCKET, 1.6);
      nm.update(3.5, notHeld);
      expect(events).toEqual([{ note: nm.pool[0], judgement: 'miss', tail: true }]);
    });
  });

  describe('bonus items', () => {
    it('lets a missed spell or crystal go without a judgement, while a hit one counts like any note', () => {
      const { nm, events } = make([
        [1, 0, 0, 'heart'],
        [2, 1],
        [3, 2, 0, 'slow'],
        [4, 3],
      ]);
      nm.setGems([{ index: 3, value: 1 }]);
      const skipped: number[] = [];
      nm.onSkip = (n) => skipped.push(n.time);
      expect(nm.press(1, 2.02)).toBe('perfect'); // the plain note is hit
      nm.update(5, notHeld); // everything else goes by
      expect(skipped).toEqual([1, 3, 4]);
      expect(events.map((e) => [e.note.time, e.judgement])).toEqual([[2, 'perfect']]);
      expect(nm.pool[0].state).toBe(NoteState.Missed);
      // Hit, a bonus item is a normal judgement.
      const { nm: nm2, events: ev2 } = make([[1, 0, 0, 'heart']]);
      expect(nm2.press(0, 1.01)).toBe('perfect');
      expect(ev2).toHaveLength(1);
    });
  });

  describe('dense streams', () => {
    it('judges the nearer of two notes in one lane when both are inside the window', () => {
      const { nm, events } = make([
        [1, 0],
        [1.1, 0],
      ]);
      expect(nm.press(0, 1.09)).toBe('perfect'); // 10 ms early for the second note, not 90 ms late for the first
      expect(nm.pool[1].state).toBe(NoteState.Hit);
      expect(nm.pool[0].state).toBe(NoteState.Pending);
      nm.update(1.2, notHeld);
      expect(events.map((e) => [e.note.time, e.judgement])).toEqual([
        [1.1, 'perfect'],
        [1, 'miss'],
      ]);
    });

    it('credits a hold in full at its end only while the finger is still down (a lost release is a Good)', () => {
      const { nm, events } = make([[1, 0, 1]]);
      expect(nm.press(0, 1)).toBe('perfect');
      nm.update(2.1, notHeld); // the finger is gone and no release ever arrived
      expect(events[1]).toMatchObject({ judgement: 'good', tail: true });
      const { nm: nm2, events: ev2 } = make([[1, 0, 1]]);
      nm2.press(0, 1);
      nm2.update(2.1, held);
      expect(ev2[1]).toMatchObject({ judgement: 'perfect', tail: true });
    });
  });
});

describe('NoteManager.rearmFrom (a tutorial step replays)', () => {
  it('arms every note from the rewind point again and puts the open ones before it away unjudged', () => {
    const { nm, events } = make([
      [1, 0],
      [2, 0, 3],
      [5, 0],
      [6, 1],
    ]);
    expect(nm.press(0, 1)).toBe('perfect');
    expect(nm.press(0, 2)).toBe('perfect'); // the hold is running
    nm.update(7, held); // the hold ends, 5 and 6 go by missed
    expect(nm.pool[2].state).toBe(NoteState.Missed);
    const before = events.length;
    nm.rearmFrom(4);
    expect(nm.pool[0].state).toBe(NoteState.Hit);
    expect([nm.pool[2].state, nm.pool[3].state]).toEqual([NoteState.Pending, NoteState.Pending]);
    expect(nm.pool[2].judgement).toBeNull();
    expect(nm.firstActive).toBe(2);
    // The replayed notes are judged afresh; nothing was emitted for the rewind itself.
    expect(events.length).toBe(before);
    expect(nm.press(0, 5.02)).toBe('perfect');
    expect(nm.press(1, 6)).toBe('perfect');
  });

  it('closes a hold still running across the rewind point without a verdict', () => {
    const { nm, events } = make([
      [1, 0, 4],
      [8, 0],
    ]);
    nm.press(0, 1);
    nm.update(2, held);
    expect(nm.pool[0].state).toBe(NoteState.Holding);
    nm.rearmFrom(1.5);
    nm.update(6, notHeld);
    expect(nm.pool[0].state).toBe(NoteState.Released);
    expect(events.filter((e) => e.tail)).toHaveLength(0);
    expect(nm.press(0, 8)).toBe('perfect');
  });
});
