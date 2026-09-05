import { describe, expect, it } from 'vitest';
import { completeDaily, dailyIndex, dailyTrackId, hashString, isDailyDone, localDateString, prevDate } from './daily';
import { emptySave } from './SaveData';

const IDS = Array.from({ length: 21 }, (_, i) => `t${i}`);

describe('daily track', () => {
  it('formats the local date with zero padding', () => {
    expect(localDateString(new Date(2026, 0, 7))).toBe('2026-01-07');
    expect(localDateString(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('walks one calendar day back across month and year edges', () => {
    expect(prevDate('2026-09-05')).toBe('2026-09-04');
    expect(prevDate('2026-03-01')).toBe('2026-02-28');
    expect(prevDate('2028-03-01')).toBe('2028-02-29');
    expect(prevDate('2026-01-01')).toBe('2025-12-31');
    expect(prevDate('garbage')).toBe('');
  });

  it('picks deterministically from the date string', () => {
    expect(hashString('2026-09-05')).toBe(hashString('2026-09-05'));
    expect(dailyIndex('2026-09-05', 21)).toBe(dailyIndex('2026-09-05', 21));
    expect(dailyTrackId('2026-09-05', IDS)).toBe(dailyTrackId('2026-09-05', IDS));
    const i = dailyIndex('2026-09-05', 21);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(21);
    expect(dailyTrackId('2026-09-05', [])).toBeNull();
  });

  it('spreads consecutive days over the catalog', () => {
    const picks = new Set<number>();
    let date = '2026-09-30';
    for (let d = 0; d < 30; d++) {
      picks.add(dailyIndex(date, 21));
      date = prevDate(date);
    }
    expect(picks.size).toBeGreaterThan(10);
  });

  it('grants the bonus once per day and tracks the streak', () => {
    let { save, granted } = completeDaily(emptySave(), '2026-09-05');
    expect(granted).toBe(true);
    expect(save.daily).toEqual({ date: '2026-09-05', done: true, streak: 1, total: 1 });
    expect(isDailyDone(save.daily, '2026-09-05')).toBe(true);
    expect(isDailyDone(save.daily, '2026-09-06')).toBe(false);

    ({ save, granted } = completeDaily(save, '2026-09-05'));
    expect(granted).toBe(false);
    expect(save.daily.total).toBe(1);

    ({ save, granted } = completeDaily(save, '2026-09-06'));
    expect(granted).toBe(true);
    expect(save.daily.streak).toBe(2);
    expect(save.daily.total).toBe(2);

    // a skipped day resets the streak but not the total
    ({ save } = completeDaily(save, '2026-09-08'));
    expect(save.daily.streak).toBe(1);
    expect(save.daily.total).toBe(3);
  });
});
