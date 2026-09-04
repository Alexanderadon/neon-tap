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

  it('applies user offset', () => {
    const time = fakeTime(0);
    const clock = new Clock(time.now, 0.05);
    clock.start(0);
    time.advance(1);
    expect(clock.songTime()).toBeCloseTo(0.95, 6);
    expect(clock.toSongTime(1)).toBeCloseTo(0.95, 6);
    expect(clock.toAudioTime(0.95)).toBeCloseTo(1, 6);
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
