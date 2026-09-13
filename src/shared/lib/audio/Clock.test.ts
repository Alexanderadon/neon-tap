import { describe, expect, it } from 'vitest';
import { Clock } from './Clock';

function fakeTime(initial = 0) {
  let t = initial;
  return { now: () => t, advance: (dt: number) => (t += dt), set: (v: number) => (t = v) };
}

describe('Clock', () => {
  it('reports 0 before start', () => {
    const time = fakeTime(10);
    const clock = new Clock(time.now);
    expect(clock.songTime()).toBe(0);
  });

  it('derives song time from the audio clock without drift', () => {
    const time = fakeTime(100);
    const clock = new Clock(time.now);
    clock.start(100.5);
    time.advance(0.5);
    expect(clock.songTime()).toBeCloseTo(0, 6);
    time.advance(180);
    expect(clock.songTime()).toBeCloseTo(180, 6);
  });

  it('applies the user offset to the judgement only: the picture stays on the sound', () => {
    const time = fakeTime(0);
    const clock = new Clock(time.now, 0.05);
    clock.start(0);
    time.advance(1);
    expect(clock.songTime()).toBeCloseTo(1, 6);
    expect(clock.judgeTime()).toBeCloseTo(0.95, 6);
    expect(clock.toSongTime(1)).toBeCloseTo(0.95, 6);
    expect(clock.toAudioTime(0.95)).toBeCloseTo(1, 6);
  });

  it('runs the heard song time behind the audio clock by the device output latency, on top of the user offset', () => {
    const time = fakeTime(0);
    const clock = new Clock(time.now, 0.02, 0.08);
    clock.start(0);
    time.advance(1);
    // The player hears position 1.0 only 80 ms later: a tile due at 0.92 meets the line now; their own 20 ms bias shifts the judgement only.
    expect(clock.songTime()).toBeCloseTo(0.92, 6);
    expect(clock.judgeTime()).toBeCloseTo(0.9, 6);
    expect(clock.toSongTime(1)).toBeCloseTo(0.9, 6);
    expect(clock.toAudioTime(0.9)).toBeCloseTo(1, 6);
    // A headset connects mid-song: the latency is updated live.
    clock.deviceLatency = 0.2;
    expect(clock.songTime()).toBeCloseTo(0.8, 6);
  });

  it('integrates rate ramps exactly (slow-motion)', () => {
    const time = fakeTime(0);
    const clock = new Clock(time.now);
    clock.start(0);
    time.set(10);
    clock.setRate(0.5, 2); // linear ramp 1 → 0.5 over [10, 12]
    expect(clock.positionAt(10)).toBeCloseTo(10, 6);
    expect(clock.positionAt(11)).toBeCloseTo(10 + 1 * 1 + (-0.5 * 1 * 1) / 4, 6); // 10.875
    expect(clock.positionAt(12)).toBeCloseTo(10 + 1.5, 6); // mean rate 0.75 × 2 s
    expect(clock.positionAt(14)).toBeCloseTo(11.5 + 2 * 0.5, 6);
    expect(clock.rateAt(11)).toBeCloseTo(0.75);
    time.set(14);
    clock.setRate(1, 1); // ramp back 0.5 → 1 over [14, 15]
    expect(clock.positionAt(15)).toBeCloseTo(12.5 + 0.75, 6);
    expect(clock.positionAt(16)).toBeCloseTo(13.25 + 1, 6);
  });

  it('keeps rate ramps consistent across pause/resume', () => {
    const time = fakeTime(0);
    const clock = new Clock(time.now);
    clock.start(0);
    time.set(5);
    clock.setRate(0.5, 0);
    time.set(6);
    clock.pause();
    time.set(20);
    clock.resume();
    time.set(21);
    expect(clock.position()).toBeCloseTo(5 + 1 * 0.5 + 1 * 0.5, 6);
  });

  it('freezes on pause and resumes at the same position', () => {
    const time = fakeTime(0);
    const clock = new Clock(time.now);
    clock.start(0);
    time.advance(2);
    clock.pause();
    time.advance(5);
    expect(clock.songTime()).toBeCloseTo(2, 6);
    expect(clock.isPaused).toBe(true);
    clock.resume();
    time.advance(1);
    expect(clock.songTime()).toBeCloseTo(3, 6);
  });
});
