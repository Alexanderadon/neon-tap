import { describe, expect, it } from 'vitest';
import { Calibration } from './Calibration';

describe('Calibration', () => {
  it('estimates latency as the median deviation from the metronome', () => {
    const c = new Calibration(120, 8);
    const first = 10;
    // Player taps consistently 60 ms late, one wild outlier at +400 ms.
    for (let i = 0; i < 7; i++) c.registerTap(first + i * 0.5 + 0.06, first);
    c.registerTap(first + 7 * 0.5 + 0.4, first);
    expect(c.done).toBe(true);
    expect(c.offsetMs).toBe(60);
  });

  it('handles early taps (negative offset)', () => {
    const c = new Calibration(120, 4);
    for (let i = 0; i < 4; i++) c.registerTap(i * 0.5 - 0.2, 0);
    expect(c.offsetMs).toBe(-200);
  });

  it('ignores taps after completion', () => {
    const c = new Calibration(120, 2);
    c.registerTap(0.01, 0);
    c.registerTap(0.51, 0);
    c.registerTap(1.3, 0);
    expect(c.deviations).toHaveLength(2);
  });
});
