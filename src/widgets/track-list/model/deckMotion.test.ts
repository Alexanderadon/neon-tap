import { describe, expect, it } from 'vitest';
import { DeckMotion, cardStyle, easeOut, flightDuration, releaseTarget, rubberBand } from './deckMotion';

describe('deck motion', () => {
  it('rubber-bands past the ends and passes the inside through', () => {
    expect(rubberBand(3.4, 10)).toBe(3.4);
    expect(rubberBand(-1.5, 10)).toBeCloseTo(-0.5);
    expect(rubberBand(10.5, 10)).toBeCloseTo(9.5);
  });

  it('flies longer for longer trips, within bounds, and eases out monotonically', () => {
    expect(flightDuration(1)).toBe(310);
    expect(flightDuration(-1)).toBe(310);
    expect(flightDuration(10)).toBe(760);
    expect(flightDuration(100)).toBe(760);
    let prev = 0;
    for (let k = 0; k <= 1; k += 0.05) {
      const v = easeOut(k);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeGreaterThan(0.9); // most of the way early, long soft landing
  });

  it('picks the release target from the flick, else the nearest card, always inside the deck', () => {
    expect(releaseTarget(4, 4.2, -30, -100, 10)).toBe(4);
    expect(releaseTarget(4, 4.6, -40, -100, 10)).toBe(5);
    expect(releaseTarget(4, 3.7, -80, 0, 10)).toBe(5);
    expect(releaseTarget(4, 4.3, -80, -9000, 10)).toBe(9); // capped at the last card
    expect(releaseTarget(1, 0.8, 80, 9000, 10)).toBe(0);
  });

  it('draws the centre card full size and dims neighbours smoothly', () => {
    expect(cardStyle(0)).toEqual({ x: 0, scale: 1, opacity: 1, z: 10 });
    expect(cardStyle(1)).toEqual({ x: 84, scale: 0.88, opacity: 0.55, z: 9 });
    expect(cardStyle(-0.5).scale).toBeCloseTo(0.94);
    expect(cardStyle(2).scale).toBe(cardStyle(1).scale); // no further shrinking beyond one card
  });

  it('follows a drag directly and lands a flight exactly on the target', () => {
    const m = new DeckMotion(3);
    m.drag(3.4);
    expect(m.pos()).toBe(3.4);
    expect(m.isFlying()).toBe(false);
    m.fly(8, 1000);
    expect(m.isFlying()).toBe(true);
    let last = m.pos();
    for (let t = 1016; t < 1000 + flightDuration(8 - 3.4); t += 16) {
      expect(m.step(t)).toBe(true);
      expect(m.pos()).toBeGreaterThanOrEqual(last);
      last = m.pos();
    }
    expect(m.step(1000 + flightDuration(8 - 3.4))).toBe(false);
    expect(m.pos()).toBe(8);
    expect(m.isFlying()).toBe(false);
    // a flight to where we already are is a no-op
    m.fly(8, 3000);
    expect(m.isFlying()).toBe(false);
  });
});
