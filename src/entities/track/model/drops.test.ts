import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  DROP_PRICE,
  WEEK_MS,
  daysUntil,
  dropState,
  emptyNextWeek,
  isDropVisible,
  isMonday,
  nextWeek,
  parseDate,
  releaseMs,
  slotDate,
  weekIndex,
} from './drops';

const HOUR = 3_600_000;
const START = '2026-10-05';
/** Monday 5 October 2026, 00:00 Moscow = Sunday 4 October, 21:00 UTC. */
const T0 = Date.UTC(2026, 9, 4, 21);
const base = { owned: false, pass: false, unlockAll: false };

describe('releaseMs', () => {
  it('is Monday 00:00 Moscow time = Sunday 21:00 UTC', () => {
    expect(releaseMs(START)).toBe(T0);
    expect(new Date(releaseMs(START)).toISOString()).toBe('2026-10-04T21:00:00.000Z');
    expect(new Date(releaseMs(START)).getUTCDay()).toBe(0);
  });

  it('opens exactly at the boundary: 1 ms before is still closed, the release instant is open', () => {
    const track = { release: START };
    expect(dropState(track, { ...base, nowMs: T0 - 1 }).soon).toBe(true);
    expect(dropState(track, { ...base, nowMs: T0 }).soon).toBe(false);
    expect(dropState(track, { ...base, nowMs: T0 }).thisWeek).toBe(true);
  });

  it('never opens for a missing or broken date', () => {
    expect(releaseMs(undefined)).toBe(Number.POSITIVE_INFINITY);
    expect(releaseMs('2026-02-30')).toBe(Number.POSITIVE_INFINITY);
    expect(releaseMs('5.10.2026')).toBe(Number.POSITIVE_INFINITY);
    expect(parseDate('2026-13-01')).toBeNull();
    expect(isDropVisible({}, Date.UTC(2100, 0, 1))).toBe(false);
  });

  it('knows Mondays and steps whole weeks', () => {
    expect(isMonday(START)).toBe(true);
    expect(isMonday('2026-10-04')).toBe(false);
    expect(isMonday('nope')).toBe(false);
    expect(slotDate(START, 1)).toBe(START);
    expect(slotDate(START, 2)).toBe('2026-10-12');
    expect(slotDate(START, 13)).toBe('2026-12-28');
    expect(releaseMs(slotDate(START, 5)) - releaseMs(START)).toBe(4 * WEEK_MS);
  });
});

describe('weekIndex', () => {
  it('is 0 before the start and 1 from the first Monday', () => {
    expect(weekIndex(T0 - 1, START)).toBe(0);
    expect(weekIndex(Date.UTC(2026, 8, 25), START)).toBe(0);
    expect(weekIndex(T0, START)).toBe(1);
    expect(weekIndex(T0 + WEEK_MS - 1, START)).toBe(1);
    expect(weekIndex(T0 + WEEK_MS, START)).toBe(2);
  });

  it('runs on past the 13 slots; the next week is null once the schedule is over', () => {
    const schedule = { start: START, weeks: 13 };
    expect(weekIndex(T0 + 13 * WEEK_MS, START)).toBe(14);
    expect(nextWeek(T0 - 1, schedule)).toBe(1);
    expect(nextWeek(T0 + 11 * WEEK_MS, schedule)).toBe(13);
    expect(nextWeek(T0 + 12 * WEEK_MS, schedule)).toBeNull();
    expect(weekIndex(T0, 'bad')).toBe(0);
  });

  it('finds the next empty week — a filled one is the drop itself', () => {
    const schedule = { start: START, weeks: 13 };
    expect(emptyNextWeek(T0 - DAY_MS, schedule, [])).toBe(1);
    expect(emptyNextWeek(T0 - DAY_MS, schedule, [{ release: START }])).toBeNull();
    expect(emptyNextWeek(T0 + HOUR, schedule, [{ release: START }])).toBe(2);
    expect(emptyNextWeek(T0 + 12 * WEEK_MS, schedule, [])).toBeNull();
  });
});

describe('dropState', () => {
  const track = { release: START };

  it('soon: not out and no PASS — locked, no ad, visible from a week before', () => {
    const s = dropState(track, { ...base, nowMs: T0 - 3 * DAY_MS });
    expect(s).toMatchObject({ open: false, soon: true, adEligible: false, thisWeek: false, early: false, price: DROP_PRICE, releaseAt: T0 });
    expect(isDropVisible(track, T0 - 7 * DAY_MS)).toBe(true);
    expect(isDropVisible(track, T0 - 7 * DAY_MS - 1)).toBe(false);
  });

  it('PASS opens it seven days early, not earlier', () => {
    expect(dropState(track, { ...base, pass: true, nowMs: T0 - 7 * DAY_MS })).toMatchObject({ open: true, soon: false, early: true });
    expect(dropState(track, { ...base, pass: true, nowMs: T0 - 7 * DAY_MS - 1 })).toMatchObject({ open: false, soon: true, early: false });
    expect(dropState(track, { ...base, pass: true, nowMs: T0 })).toMatchObject({ open: true, early: false, thisWeek: true });
  });

  it('the ad works for the first 14 days after the release, crystals (150) always', () => {
    expect(dropState(track, { ...base, nowMs: T0 }).adEligible).toBe(true);
    expect(dropState(track, { ...base, nowMs: T0 + 14 * DAY_MS - 1 }).adEligible).toBe(true);
    const late = dropState(track, { ...base, nowMs: T0 + 14 * DAY_MS });
    expect(late).toMatchObject({ adEligible: false, open: false, soon: false, price: 150 });
    expect(dropState(track, { ...base, nowMs: T0 + WEEK_MS }).thisWeek).toBe(false);
  });

  it('owned or unlock-all is open, never offered an ad', () => {
    expect(dropState(track, { ...base, owned: true, nowMs: T0 + DAY_MS })).toMatchObject({ open: true, adEligible: false, soon: false });
    expect(dropState(track, { ...base, owned: true, nowMs: T0 - DAY_MS })).toMatchObject({ open: true, soon: false, early: false });
    expect(dropState(track, { ...base, unlockAll: true, nowMs: T0 - DAY_MS })).toMatchObject({ open: true, soon: false });
  });

  it('counts whole days to the release: 1 is «завтра»', () => {
    expect(daysUntil(T0, T0 - 14 * HOUR)).toBe(1);
    expect(daysUntil(T0, T0 - DAY_MS)).toBe(1);
    expect(daysUntil(T0, T0 - DAY_MS - 1)).toBe(2);
    expect(daysUntil(T0, T0 - 6.5 * DAY_MS)).toBe(7);
    expect(daysUntil(T0, T0)).toBe(0);
    expect(daysUntil(Number.POSITIVE_INFINITY, T0)).toBe(Number.POSITIVE_INFINITY);
  });
});
