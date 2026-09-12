import { describe, expect, it } from 'vitest';
import { SpinTracker } from './SpinTracker';
import { SPIN_TAP_REV } from '@/shared/config/constants';

/** Feed `turns` revolutions of a circle around the tracker's centre in `steps` moves. */
function circle(tr: SpinTracker, turns: number, steps = 40, dir = 1, r = 80, from = 0, t0 = 0): number {
  const total = Math.round(steps * turns);
  let t = t0;
  for (let i = 0; i <= total; i++) {
    const a = from + dir * (i / steps) * Math.PI * 2;
    t = t0 + i * 0.01;
    if (i === 0) tr.down(1, tr.cx + r * Math.cos(a), tr.cy + r * Math.sin(a), t);
    else tr.move(1, tr.cx + r * Math.cos(a), tr.cy + r * Math.sin(a), t);
  }
  return t;
}

describe('SpinTracker', () => {
  it('counts revolutions of a circling pointer, either direction', () => {
    const cw = new SpinTracker(100, 100, 90);
    circle(cw, 3);
    expect(cw.revolutions).toBeCloseTo(3, 1);
    const ccw = new SpinTracker(100, 100, 90);
    circle(ccw, 2.5, 40, -1);
    expect(ccw.revolutions).toBeCloseTo(2.5, 1);
  });

  it('does not count jitter back and forth, nor a thumb resting at the centre', () => {
    const tr = new SpinTracker(100, 100, 90);
    tr.down(1, 180, 100, 0);
    for (let i = 0; i < 50; i++) tr.move(1, 180, 100 + (i % 2 ? 6 : -6), i * 0.01);
    expect(tr.revolutions).toBeLessThan(0.05);
    const rest = new SpinTracker(100, 100, 90);
    rest.down(1, 103, 100, 0);
    for (let i = 0; i < 40; i++) rest.move(1, 100 + 5 * Math.cos(i), 100 + 5 * Math.sin(i), i * 0.01);
    expect(rest.revolutions).toBe(0);
  });

  it('follows only the first pointer down and continues after it lifts and a new one lands', () => {
    const tr = new SpinTracker(100, 100, 90);
    circle(tr, 1);
    tr.down(2, 190, 100, 1);
    tr.move(2, 100, 190, 1.1);
    tr.move(2, 10, 100, 1.2);
    expect(tr.revolutions).toBeCloseTo(1, 1);
    tr.up(1);
    circle(tr, 1, 40, 1, 80, 0, 2);
    expect(tr.revolutions).toBeCloseTo(2, 1);
  });

  it('adds a fixed slice per tap (keyboard fallback) and reports the spin rate', () => {
    const tr = new SpinTracker(100, 100, 90);
    for (let i = 0; i < 10; i++) tr.tap(i * 0.05);
    expect(tr.revolutions).toBeCloseTo(10 * SPIN_TAP_REV, 5);
    const fast = new SpinTracker(100, 100, 90);
    const end = circle(fast, 2, 40); // 2 revolutions in 0.8 s
    expect(fast.rate(end)).toBeGreaterThan(2);
    expect(fast.rate(end + 1)).toBe(0);
    fast.reset();
    expect(fast.revolutions).toBe(0);
    // The finger that was circling keeps counting after a reset — a spinner starts under a moving thumb.
    circle(fast, 1, 40, 1, 80, 0, 5);
    expect(fast.revolutions).toBeCloseTo(1, 1);
  });
});
