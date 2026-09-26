import { describe, expect, it } from 'vitest';
import { OffsetProbe, PROBE_MIN_SAMPLES, type ProbeNote } from './offsetProbe';

/** `count` taps on lane 0 of a single-lane section, `step` seconds apart from `from`. */
function taps(count: number, step = 0.5, from = 5, lanes = 1, lane = 0): ProbeNote[] {
  return Array.from({ length: count }, (_, i) => ({ time: from + i * step, lane, lanes, kind: null }));
}

describe('OffsetProbe', () => {
  it('learns a Bluetooth lag the hit windows never see: eight presses 220 ms late settle on +220 ms', () => {
    const notes = taps(10);
    const probe = new OffsetProbe(notes, 'single-lane');
    for (let i = 0; i < PROBE_MIN_SAMPLES - 1; i++) {
      expect(probe.press(0, notes[i].time + 0.22 + (i % 2 ? 0.01 : -0.01), 1, 0)).toBe(true);
      expect(probe.settled()).toBeNull();
    }
    probe.press(0, notes[7].time + 0.23, 1, 0);
    expect(probe.settled()).toBeCloseTo(0.22, 3);
  });

  it('gives a press to its own tile, not the nearer next one: 270 ms late on taps half a second apart is +270 ms', () => {
    const notes = taps(10);
    const probe = new OffsetProbe(notes, 'single-lane');
    notes.forEach((n) => probe.press(0, n.time + 0.27, 1, 0));
    expect(probe.count).toBe(10);
    expect(probe.settled()).toBeCloseTo(0.27, 3);
    // Early presses work the same way round.
    const early = new OffsetProbe(notes, 'single-lane');
    notes.forEach((n) => early.press(0, n.time - 0.27, 1, 0));
    expect(early.settled()).toBeCloseTo(-0.27, 3);
  });

  it('takes one press per note and nothing beyond ±300 ms', () => {
    const notes = taps(3, 1);
    const probe = new OffsetProbe(notes, 'single-lane');
    expect(probe.press(0, notes[0].time + 0.1, 1, 0)).toBe(true);
    expect(probe.press(0, notes[0].time + 0.12, 1, 0)).toBe(false); // the same note again
    expect(probe.press(0, notes[1].time + 0.35, 1, 0)).toBe(false); // too far
    expect(probe.press(0, notes[1].time - 0.29, 1, 0)).toBe(true);
    expect(probe.count).toBe(2);
  });

  it('counts only single-lane sections in the tutorial mode, and only plain taps and holds', () => {
    const notes: ProbeNote[] = [
      { time: 1, lane: 0, lanes: 2, kind: null },
      { time: 2, lane: 0, lanes: 1, kind: 'slide' },
      { time: 3, lane: 0, lanes: 1, kind: 'slow' },
      { time: 4, lane: 0, lanes: 1, kind: null },
    ];
    const probe = new OffsetProbe(notes, 'single-lane');
    expect(probe.press(0, 1.1, 1, 0)).toBe(false);
    expect(probe.press(0, 2.1, 1, 0)).toBe(false);
    expect(probe.press(0, 3.1, 1, 0)).toBe(false);
    expect(probe.press(0, 4.1, 1, 0)).toBe(true);
  });

  it('never settles on scattered presses (a child tapping at random)', () => {
    const notes = taps(16, 1);
    const probe = new OffsetProbe(notes, 'single-lane');
    const scatter = [0.25, -0.2, 0.1, -0.28, 0.18, -0.05, 0.29, -0.15, 0.02, -0.26, 0.22, -0.1];
    scatter.forEach((d, i) => probe.press(0, notes[i].time + d, 1, 0));
    expect(probe.count).toBe(scatter.length);
    expect(probe.settled()).toBeNull();
  });

  it('measures in real seconds on a faster level and adds the offset each press was judged with', () => {
    const notes = taps(8, 1);
    const probe = new OffsetProbe(notes, 'single-lane');
    // Level 2 (×1.2): 0.24 song-seconds late is 0.2 real seconds; the clock already carried +50 ms.
    notes.forEach((n) => probe.press(0, n.time + 0.24, 1.2, 0.05));
    expect(probe.settled()).toBeCloseTo(0.25, 3);
  });

  it('in a run, leaves out notes a lagging press could be taken for their neighbour', () => {
    const dense = taps(8, 0.25, 10, 4, 2); // a stream on lane 2
    const lone = taps(8, 1, 20, 4, 1); // one tap a second on lane 1
    const probe = new OffsetProbe([...dense, ...lone], 'all-lanes');
    dense.forEach((n) => expect(probe.press(2, n.time + 0.2, 1, 0)).toBe(false));
    lone.forEach((n) => expect(probe.press(1, n.time + 0.2, 1, 0)).toBe(true));
    expect(probe.press(0, 20.2, 1, 0)).toBe(false); // wrong lane: nothing there
    expect(probe.settled()).toBeCloseTo(0.2, 3);
  });

  it('lets the same notes give samples again on the next pass', () => {
    const notes = taps(4, 1);
    const probe = new OffsetProbe(notes, 'single-lane');
    notes.forEach((n) => probe.press(0, n.time + 0.2, 1, 0));
    expect(probe.press(0, notes[0].time + 0.2, 1, 0)).toBe(false);
    probe.rearm();
    notes.forEach((n) => expect(probe.press(0, n.time + 0.2, 1, 0)).toBe(true));
    expect(probe.settled()).toBeCloseTo(0.2, 3);
  });
});
