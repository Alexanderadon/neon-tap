import { describe, expect, it } from 'vitest';
import { Conductor } from './Conductor';

describe('Conductor', () => {
  const c = new Conductor(120, 0.5);

  it('computes beats from bpm and offset', () => {
    expect(c.secondsPerBeat).toBe(0.5);
    expect(c.beatAt(0.5)).toBe(0);
    expect(c.beatAt(2.5)).toBe(4);
    expect(c.barAt(2.5)).toBe(1);
  });

  it('phase wraps within [0, 1)', () => {
    expect(c.beatPhase(0.5)).toBeCloseTo(0);
    expect(c.beatPhase(0.75)).toBeCloseTo(0.5);
    expect(c.beatPhase(0.99)).toBeCloseTo(0.98);
  });

  it('snaps to nearest beat', () => {
    expect(c.nearestBeatTime(1.2)).toBeCloseTo(1.0);
    expect(c.nearestBeatTime(1.3)).toBeCloseTo(1.5);
  });
});
