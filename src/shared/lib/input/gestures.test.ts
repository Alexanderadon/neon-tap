import { describe, expect, it } from 'vitest';
import { BACK_EDGE_PX, BACK_PX, SWIPE_PX, flickCards, isBackSwipe, velocityOf } from './gestures';

describe('flickCards', () => {
  it('ignores a short, slow drag', () => {
    expect(flickCards(-20, -100)).toBe(0);
    expect(flickCards(30, 200)).toBe(0);
  });

  it('flips one card on a slow drag past the threshold, towards the drag direction', () => {
    expect(flickCards(-SWIPE_PX, 0)).toBe(1); // dragged left → next card
    expect(flickCards(SWIPE_PX + 10, 0)).toBe(-1); // dragged right → previous card
  });

  it('flies several cards on a fast flick, capped at ten', () => {
    expect(flickCards(-80, -1200)).toBe(2);
    expect(flickCards(-80, -2600)).toBe(4);
    expect(flickCards(-80, -50000)).toBe(10);
    expect(flickCards(80, 2600)).toBe(-4);
  });

  it('accepts a quick flick even when the finger barely moved', () => {
    expect(flickCards(-15, -900)).toBe(1);
    expect(flickCards(15, 900)).toBe(-1);
  });
});

describe('velocityOf', () => {
  it('returns px/s from two samples and 0 for coincident samples', () => {
    expect(velocityOf({ x: 0, t: 1000 }, { x: -50, t: 1050 })).toBe(-1000);
    expect(velocityOf({ x: 0, t: 1000 }, { x: 40, t: 1000 })).toBe(0);
  });
});

describe('isBackSwipe', () => {
  it('needs a left-edge start, enough rightward travel and a mostly horizontal path', () => {
    expect(isBackSwipe({ x: 4, y: 300 }, { x: 4 + BACK_PX, y: 310 })).toBe(true);
    expect(isBackSwipe({ x: BACK_EDGE_PX + 1, y: 300 }, { x: 200, y: 300 })).toBe(false);
    expect(isBackSwipe({ x: 4, y: 300 }, { x: 4 + BACK_PX - 1, y: 300 })).toBe(false);
    expect(isBackSwipe({ x: 4, y: 300 }, { x: 4 + BACK_PX, y: 300 + BACK_PX })).toBe(false);
    expect(isBackSwipe({ x: 4, y: 300 }, { x: -100, y: 300 })).toBe(false);
  });
});
