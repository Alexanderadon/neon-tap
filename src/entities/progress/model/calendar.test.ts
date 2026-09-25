import { describe, expect, it } from 'vitest';
import { CALENDAR_REWARDS, EMPTY_CALENDAR, calendarView, markCalendar, type CalendarState } from './calendar';

describe('login calendar', () => {
  it('pays 5 · 5 · 10 · 10 · 15 · 15 · 30 — 90 crystals a loop', () => {
    expect(CALENDAR_REWARDS).toEqual([5, 5, 10, 10, 15, 15, 30]);
    expect(CALENDAR_REWARDS.reduce((a, b) => a + b, 0)).toBe(90);
  });

  it('marks a day once', () => {
    const first = markCalendar(EMPTY_CALENDAR, '2026-10-05');
    expect(first).toEqual({ state: { count: 1, date: '2026-10-05' }, mark: { day: 1, reward: 5 } });
    const again = markCalendar(first.state, '2026-10-05');
    expect(again.mark).toBeNull();
    expect(again.state).toBe(first.state);
    expect(markCalendar(EMPTY_CALENDAR, '').mark).toBeNull();
  });

  it('a missed day resets nothing: the next mark follows the last one', () => {
    const a = markCalendar(EMPTY_CALENDAR, '2026-10-05').state;
    const b = markCalendar(a, '2026-10-06').state;
    const c = markCalendar(b, '2026-10-20'); // two weeks away
    expect(c.mark).toEqual({ day: 3, reward: 10 });
    expect(c.state.count).toBe(3);
  });

  it('loops after the seventh mark', () => {
    let state: CalendarState = EMPTY_CALENDAR;
    const rewards: number[] = [];
    for (let d = 1; d <= 9; d++) {
      const r = markCalendar(state, `2026-10-${String(d).padStart(2, '0')}`);
      state = r.state;
      rewards.push(r.mark!.reward);
    }
    expect(rewards).toEqual([5, 5, 10, 10, 15, 15, 30, 5, 5]);
    expect(state.count).toBe(9);
  });

  it('shows the marks of the current loop, today’s one included', () => {
    expect(calendarView(EMPTY_CALENDAR, '2026-10-05')).toEqual({ done: 0, today: false, next: 0 });
    expect(calendarView({ count: 3, date: '2026-10-05' }, '2026-10-05')).toEqual({ done: 3, today: true, next: 3 });
    expect(calendarView({ count: 3, date: '2026-10-05' }, '2026-10-06')).toEqual({ done: 3, today: false, next: 3 });
    // the seventh mark made today still shows a full loop; tomorrow a new one starts
    expect(calendarView({ count: 7, date: '2026-10-11' }, '2026-10-11')).toEqual({ done: 7, today: true, next: 0 });
    expect(calendarView({ count: 7, date: '2026-10-11' }, '2026-10-12')).toEqual({ done: 0, today: false, next: 0 });
    expect(calendarView({ count: 8, date: '2026-10-12' }, '2026-10-12')).toEqual({ done: 1, today: true, next: 1 });
  });
});
