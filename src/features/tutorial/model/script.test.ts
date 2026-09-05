import { describe, expect, it } from 'vitest';
import { TUTORIAL_PLAN, beatTime, buildScript, captionAt, stepProgress } from './script';

/** A perfectly even 120 BPM grid starting at 1.0 s. */
const BEATS = Array.from({ length: 200 }, (_, i) => 1 + i * 0.5);

describe('tutorial script', () => {
  it('maps beat indices to song seconds, including fractions and open ends', () => {
    expect(beatTime(BEATS, 0)).toBe(1);
    expect(beatTime(BEATS, 10)).toBe(6);
    expect(beatTime(BEATS, 10.5)).toBeCloseTo(6.25, 6);
    expect(beatTime(BEATS, -Infinity)).toBe(-Infinity);
    expect(beatTime(BEATS, Infinity)).toBe(Infinity);
    // Past the last beat → extrapolate with the last interval.
    expect(beatTime(BEATS, 205)).toBeCloseTo(1 + 205 * 0.5, 6);
  });

  it('builds contiguous, sorted steps with copy for every plan entry', () => {
    const script = buildScript(BEATS);
    expect(script).toHaveLength(TUTORIAL_PLAN.length);
    expect(script[0].from).toBe(-Infinity);
    expect(script[script.length - 1].to).toBe(Infinity);
    for (let i = 1; i < script.length; i++) {
      expect(script[i].from).toBe(script[i - 1].to);
      expect(script[i].from).toBeGreaterThan(script[i - 1].from);
    }
    for (const s of script) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.text.length).toBeGreaterThan(0);
      expect(s.hintDesktop.length).toBeGreaterThan(0);
      expect(s.hintTouch.length).toBeGreaterThan(0);
    }
  });

  it('finds the caption for any song time, including the lead-in', () => {
    const script = buildScript(BEATS);
    expect(script[captionAt(script, -2)].id).toBe('intro');
    expect(script[captionAt(script, 0)].id).toBe('intro');
    const tap = script.find((s) => s.id === 'tap')!;
    expect(captionAt(script, tap.from)).toBe(script.indexOf(tap));
    expect(captionAt(script, tap.to - 1e-6)).toBe(script.indexOf(tap));
    expect(captionAt(script, tap.to)).toBe(script.indexOf(tap) + 1);
    expect(script[captionAt(script, 10_000)].id).toBe('free');
    expect(captionAt(script, NaN)).toBe(-1);
    expect(captionAt([], 3)).toBe(-1);
  });

  it('reports step progress in 0..1 and handles open-ended steps', () => {
    const script = buildScript(BEATS);
    const hold = script.find((s) => s.id === 'hold')!;
    expect(stepProgress(hold, hold.from - 1)).toBe(0);
    expect(stepProgress(hold, (hold.from + hold.to) / 2)).toBeCloseTo(0.5, 6);
    expect(stepProgress(hold, hold.to + 1)).toBe(1);
    expect(stepProgress(script[0], -5)).toBe(0);
    expect(stepProgress(script[0], script[0].to)).toBe(1);
    expect(stepProgress(script[script.length - 1], 1e9)).toBe(0);
  });
});
