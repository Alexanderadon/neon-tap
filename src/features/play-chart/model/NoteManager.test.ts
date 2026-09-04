import { describe, expect, it } from 'vitest';
import { NoteManager, NoteState, type JudgeEvent } from './NoteManager';

function make(notes: Array<[number, number, number?]>, assistWindow = 0) {
  const nm = new NoteManager(50, { assistWindow });
  const events: JudgeEvent[] = [];
  nm.onJudge = (e) => events.push(e);
  nm.load(notes.map(([time, lane, duration = 0]) => ({ time, lane, duration, kind: null, seq: 0, lanes: 4 })));
  return { nm, events };
}

const notHeld = () => false;
const held = () => true;

describe('NoteManager', () => {
  it('judges taps by GDD windows: 0.030 → perfect, 0.080 → great, 0.200 → miss', () => {
    const { nm, events } = make([[1, 0], [2, 1], [3, 2]]);
    expect(nm.press(0, 1.03)).toBe('perfect');
    expect(nm.press(1, 2.08)).toBe('great');
    expect(nm.press(2, 3.2)).toBeNull(); // outside window: press ignored…
    nm.update(3.2, notHeld); // …and the note is auto-missed
    expect(events.map((e) => e.judgement)).toEqual(['perfect', 'great', 'miss']);
    expect(nm.pool[2].state).toBe(NoteState.Missed);
  });

  it('ignores presses when the next note is far in the future', () => {
    const { nm, events } = make([[5, 0]]);
    expect(nm.press(0, 1)).toBeNull();
    expect(events).toHaveLength(0);
    expect(nm.pool[0].state).toBe(NoteState.Pending);
  });

  it('judges the earliest pending note in the lane', () => {
    const { nm } = make([[1, 0], [1.1, 0]]);
    expect(nm.press(0, 1.04)).toBe('perfect');
    expect(nm.pool[0].state).toBe(NoteState.Hit);
    expect(nm.pool[1].state).toBe(NoteState.Pending);
  });

  it('handles holds: head + tail judgements', () => {
    const { nm, events } = make([[1, 3, 1]]);
    expect(nm.press(3, 1.0)).toBe('perfect');
    expect(nm.pool[0].state).toBe(NoteState.Holding);
    nm.update(1.5, held);
    expect(nm.pool[0].state).toBe(NoteState.Holding);
    nm.update(2.0, held);
    expect(nm.pool[0].state).toBe(NoteState.Released);
    expect(events.map((e) => [e.judgement, e.tail])).toEqual([
      ['perfect', false],
      ['perfect', true],
    ]);
  });

  it('breaks a hold released too early', () => {
    const { nm, events } = make([[1, 3, 1]]);
    nm.press(3, 1.0);
    nm.release(3, 1.4);
    expect(events[1]).toMatchObject({ judgement: 'miss', tail: true });
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
    it('arms an early press and judges Great when the note arrives', () => {
      const { nm, events } = make([[1, 0]], 0.4);
      expect(nm.press(0, 0.7)).toBeNull();
      expect(nm.pool[0].armed).toBe(true);
      nm.update(0.85, notHeld);
      expect(nm.pool[0].state).toBe(NoteState.Pending);
      nm.update(0.92, notHeld);
      expect(nm.pool[0].state).toBe(NoteState.Hit);
      expect(events).toEqual([expect.objectContaining({ judgement: 'great', tail: false })]);
    });

    it('does not arm presses further ahead than the assist window', () => {
      const { nm } = make([[1, 0]], 0.4);
      nm.press(0, 0.5);
      expect(nm.pool[0].armed).toBe(false);
    });

    it('is off by default (desktop keeps strict timing)', () => {
      const { nm } = make([[1, 0]]);
      nm.press(0, 0.7);
      nm.update(0.95, notHeld);
      expect(nm.pool[0].state).toBe(NoteState.Pending);
    });
  });
});

describe('circles', () => {
  it('are hit only from the circle bucket, never by lane keys', () => {
    const nm = new NoteManager(50);
    const events: JudgeEvent[] = [];
    nm.onJudge = (e) => events.push(e);
    nm.load([{ time: 1, lane: 2, duration: 0, kind: 'circle', seq: 1, lanes: 4 }]);
    expect(nm.press(2, 1.0)).toBeNull(); // lane key under the circle does nothing
    expect(nm.pool[0].state).toBe(NoteState.Pending);
    expect(nm.press(7, 1.02)).toBe('perfect'); // CIRCLE_BUCKET
    expect(events).toHaveLength(1);
  });
});
