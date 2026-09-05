import { describe, expect, it } from 'vitest';
import { BEAT_STRENGTH, BeatCursor, DOWNBEAT_STRENGTH } from './BeatCursor';

const beats = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5];

describe('BeatCursor', () => {
  it('fires each beat once, downbeats stronger', () => {
    const c = new BeatCursor(beats);
    expect(c.poll(0)).toBe(0);
    expect(c.poll(0.49)).toBe(0);
    expect(c.poll(0.5)).toBe(DOWNBEAT_STRENGTH);
    expect(c.poll(0.51)).toBe(0);
    expect(c.poll(1.02)).toBe(BEAT_STRENGTH);
    expect(c.poll(1.6)).toBe(BEAT_STRENGTH);
    expect(c.poll(2.1)).toBe(BEAT_STRENGTH);
    expect(c.poll(2.55)).toBe(DOWNBEAT_STRENGTH);
    expect(c.next).toBe(5);
  });

  it('collapses several beats crossed in a stalled frame into one pulse and skips stale ones', () => {
    const c = new BeatCursor(beats);
    // A 1.2 s stall: beats 0.5..1.5 are all older than maxLag, the 1.5 one is within it.
    expect(c.poll(1.7)).toBe(BEAT_STRENGTH);
    expect(c.next).toBe(3);
    // Two beats within lag in one frame (2.0 and the 2.5 downbeat) → the stronger wins.
    const d = new BeatCursor(beats);
    expect(d.poll(1.9)).toBe(0);
    expect(d.next).toBe(3);
    expect(d.poll(2.6, 0.7)).toBe(DOWNBEAT_STRENGTH);
    expect(d.next).toBe(5);
  });

  it('re-syncs when the song time goes backwards (restart / resume rewind)', () => {
    const c = new BeatCursor(beats);
    c.poll(3.1);
    expect(c.next).toBe(6);
    expect(c.poll(2.2)).toBe(0);
    expect(c.next).toBe(4);
    expect(c.poll(2.5)).toBe(DOWNBEAT_STRENGTH);
    c.reset();
    expect(c.next).toBe(0);
    expect(c.poll(0.5)).toBe(DOWNBEAT_STRENGTH);
  });

  it('phase runs 0 → 1 between beats and clamps outside the list', () => {
    const c = new BeatCursor(beats);
    expect(c.phase(0.5)).toBe(0);
    expect(c.phase(0.75)).toBeCloseTo(0.5);
    expect(c.phase(0.99)).toBeCloseTo(0.98);
    expect(c.phase(-1)).toBe(0);
    expect(c.phase(100)).toBe(1);
  });

  it('falls back to a bpm grid when the chart has no beat list', () => {
    const c = new BeatCursor(undefined, 120, 0.25, 2.3);
    expect(c.length).toBe(5); // 0.25, 0.75, 1.25, 1.75, 2.25
    expect(c.poll(0.25)).toBe(DOWNBEAT_STRENGTH);
    expect(c.poll(0.8)).toBe(BEAT_STRENGTH);
    const empty = new BeatCursor([], 100, 0, 0);
    expect(empty.length).toBe(1);
    expect(empty.phase(0)).toBe(0);
  });
});
