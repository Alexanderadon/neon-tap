import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  HOUR_MS,
  LIMITED_PERIOD_MS,
  LIMITED_WINDOW_MS,
  MUSIC_MIN_RUNS,
  MUSIC_REPEAT_MS,
  countdownText,
  hoursLeft,
  limitedWindow,
  musicOfferDue,
} from './schedule';

const ANCHOR = 1_700_000_000_000;

describe('limitedWindow', () => {
  it('is open for 48 hours from the first launch', () => {
    const w0 = limitedWindow(ANCHOR, ANCHOR);
    expect(w0).toEqual({ start: ANCHOR, end: ANCHOR + LIMITED_WINDOW_MS, active: true, remainingMs: LIMITED_WINDOW_MS });
    const late = limitedWindow(ANCHOR, ANCHOR + LIMITED_WINDOW_MS - 1);
    expect(late.active).toBe(true);
    expect(late.remainingMs).toBe(1);
  });

  it('closes after 48 hours and points at the next window 14 days from the anchor', () => {
    const w = limitedWindow(ANCHOR, ANCHOR + LIMITED_WINDOW_MS);
    expect(w.active).toBe(false);
    expect(w.remainingMs).toBe(0);
    expect(w.start).toBe(ANCHOR + LIMITED_PERIOD_MS);
    expect(w.end).toBe(ANCHOR + LIMITED_PERIOD_MS + LIMITED_WINDOW_MS);
    expect(limitedWindow(ANCHOR, ANCHOR + 10 * DAY_MS).start).toBe(ANCHOR + LIMITED_PERIOD_MS);
  });

  it('reopens every 14 days', () => {
    for (const k of [1, 2, 7]) {
      const start = ANCHOR + k * LIMITED_PERIOD_MS;
      expect(limitedWindow(ANCHOR, start).active).toBe(true);
      expect(limitedWindow(ANCHOR, start + 47 * HOUR_MS)).toMatchObject({ start, active: true, remainingMs: HOUR_MS });
      expect(limitedWindow(ANCHOR, start + 49 * HOUR_MS).active).toBe(false);
      expect(limitedWindow(ANCHOR, start - 1).active).toBe(false);
    }
  });

  it('treats a clock before the anchor as "not open yet"', () => {
    const w = limitedWindow(ANCHOR, ANCHOR - DAY_MS);
    expect(w.active).toBe(false);
    expect(w.start).toBe(ANCHOR);
  });
});

describe('musicOfferDue', () => {
  it('waits for the third finished run', () => {
    expect(musicOfferDue({ runs: MUSIC_MIN_RUNS - 1, shownAt: null, bought: false }, ANCHOR)).toBe(false);
    expect(musicOfferDue({ runs: MUSIC_MIN_RUNS, shownAt: null, bought: false }, ANCHOR)).toBe(true);
  });

  it('repeats at most once every 7 days', () => {
    expect(musicOfferDue({ runs: 10, shownAt: ANCHOR, bought: false }, ANCHOR + MUSIC_REPEAT_MS - 1)).toBe(false);
    expect(musicOfferDue({ runs: 10, shownAt: ANCHOR, bought: false }, ANCHOR + MUSIC_REPEAT_MS)).toBe(true);
  });

  it('never returns once bought', () => {
    expect(musicOfferDue({ runs: 10, shownAt: null, bought: true }, ANCHOR + 30 * DAY_MS)).toBe(false);
  });
});

describe('countdown text', () => {
  it('formats hours:minutes:seconds, zero-padded, never negative', () => {
    expect(countdownText(LIMITED_WINDOW_MS)).toBe('48:00:00');
    expect(countdownText(LIMITED_WINDOW_MS - 1)).toBe('47:59:59');
    expect(countdownText(65_000)).toBe('00:01:05');
    expect(countdownText(-5)).toBe('00:00:00');
  });

  it('rounds the hours left up for the header tag', () => {
    expect(hoursLeft(LIMITED_WINDOW_MS)).toBe(48);
    expect(hoursLeft(LIMITED_WINDOW_MS - 1)).toBe(48);
    expect(hoursLeft(HOUR_MS)).toBe(1);
    expect(hoursLeft(1)).toBe(1);
    expect(hoursLeft(0)).toBe(0);
  });
});
