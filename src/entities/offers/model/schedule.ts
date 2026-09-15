export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

/** The 48-hour deal opens every 14 days from the first launch and lasts 48 hours. */
export const LIMITED_PERIOD_MS = 14 * DAY_MS;
export const LIMITED_WINDOW_MS = 48 * HOUR_MS;

/** The music pack is first offered after the third finished run, then at most once a week until bought. */
export const MUSIC_MIN_RUNS = 3;
export const MUSIC_REPEAT_MS = 7 * DAY_MS;

export interface LimitedWindow {
  /** Start and end of the window this moment belongs to (or the next one when none is open). */
  start: number;
  end: number;
  active: boolean;
  /** Milliseconds until the open window closes; 0 when none is open. */
  remainingMs: number;
}

/**
 * The deal's window around `now`: windows open at `anchor + k · period` (k ≥ 0) and close 48 h
 * later. A clock set before the anchor sees the first window as not yet open.
 */
export function limitedWindow(anchor: number, now: number): LimitedWindow {
  const k = Math.max(0, Math.floor((now - anchor) / LIMITED_PERIOD_MS));
  const start = anchor + k * LIMITED_PERIOD_MS;
  const end = start + LIMITED_WINDOW_MS;
  if (now >= start && now < end) return { start, end, active: true, remainingMs: end - now };
  const nextStart = now < start ? start : start + LIMITED_PERIOD_MS;
  return { start: nextStart, end: nextStart + LIMITED_WINDOW_MS, active: false, remainingMs: 0 };
}

export interface MusicOfferState {
  /** Finished (non-failed) runs so far. */
  runs: number;
  /** When the popup was last shown, or null. */
  shownAt: number | null;
  bought: boolean;
}

/** Whether the music pack popup is due now. */
export function musicOfferDue({ runs, shownAt, bought }: MusicOfferState, now: number): boolean {
  if (bought || runs < MUSIC_MIN_RUNS) return false;
  return shownAt === null || now - shownAt >= MUSIC_REPEAT_MS;
}

/** «47:59:59» — hours (unbounded), minutes and seconds, zero-padded; never negative. */
export function countdownText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(h)}:${two(m)}:${two(s)}`;
}

/** Whole hours left, rounded up («48 ч» at the very start, «1 ч» in the last hour); 0 when nothing is left. */
export function hoursLeft(ms: number): number {
  return Math.max(0, Math.ceil(ms / HOUR_MS));
}
