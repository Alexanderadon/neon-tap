import { describe, expect, it } from 'vitest';
import { HeldLanes, eventAge } from './heldLanes';

describe('HeldLanes', () => {
  it('counts a second contact on a held lane as a fresh tap (rolling double taps are two taps)', () => {
    const h = new HeldLanes(8);
    expect(h.press(2, false)).toBe('tap');
    expect(h.isHeld(2)).toBe(true);
    expect(h.press(2, false)).toBe('tap'); // second thumb before the first lifted
    expect(h.isHeld(2)).toBe(true);
    expect(h.release(2)).toBe(true);
    expect(h.isHeld(2)).toBe(false);
    expect(h.release(2)).toBe(false);
  });

  it('treats a finger sliding into a free lane as a slide, and into a held lane as nothing', () => {
    const h = new HeldLanes(8);
    expect(h.press(1, true)).toBe('slide');
    expect(h.isHeld(1)).toBe(true);
    expect(h.press(1, true)).toBe('none');
    h.clear();
    expect(h.isHeld(1)).toBe(false);
  });
});

describe('eventAge', () => {
  it('returns the plausible age of an event and 0 for anything else', () => {
    expect(eventAge(1000, 984)).toBeCloseTo(0.016);
    expect(eventAge(1000, 1000)).toBe(0);
    expect(eventAge(1000, 1400)).toBe(0); // event "from the future": unknown clock
    expect(eventAge(1000, 200)).toBe(0); // 0.8 s old: not a real key press age
    expect(eventAge(5000, 1_700_000_000_000)).toBe(0); // epoch-based timestamp
  });
});
