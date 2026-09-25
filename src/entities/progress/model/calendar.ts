/**
 * The login calendar: seven marks in a loop, one for the first passed run of a day. A missed day
 * resets nothing — the next mark simply follows the last one.
 */

/** Crystals for the marks of a loop, first to seventh (90 a loop). */
export const CALENDAR_REWARDS: readonly number[] = [5, 5, 10, 10, 15, 15, 30];

export interface CalendarState {
  /** Marks ever made; the place in the loop is `count % 7`. */
  count: number;
  /** Local date (YYYY-MM-DD) of the last mark. */
  date: string;
}

export const EMPTY_CALENDAR: CalendarState = { count: 0, date: '' };

/** A mark just made: its place in the loop (1–7) and its crystals. */
export interface CalendarMark {
  day: number;
  reward: number;
}

/** Mark `date` once: null when it is marked already (or the date is empty). Pure. */
export function markCalendar(state: CalendarState, date: string): { state: CalendarState; mark: CalendarMark | null } {
  if (!date || state.date === date) return { state, mark: null };
  const index = state.count % CALENDAR_REWARDS.length;
  return { state: { count: state.count + 1, date }, mark: { day: index + 1, reward: CALENDAR_REWARDS[index] } };
}

/** What the calendar strip shows on `date`. */
export interface CalendarView {
  /** Marks made in the current loop (0–7); a loop completed today still shows all seven. */
  done: number;
  /** Today is marked already. */
  today: boolean;
  /** Index (0–6) of the mark the next day's first passed run makes. */
  next: number;
}

export function calendarView(state: CalendarState, date: string): CalendarView {
  const size = CALENDAR_REWARDS.length;
  const today = state.count > 0 && state.date === date;
  const done = today ? ((state.count - 1) % size) + 1 : state.count % size;
  return { done, today, next: state.count % size };
}
