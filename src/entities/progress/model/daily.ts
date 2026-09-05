import type { DailyState, SaveData } from './SaveData';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as `YYYY-MM-DD` — the daily track changes at local midnight. */
export function localDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The calendar day before `date` (both `YYYY-MM-DD`), computed in UTC so DST never shifts it. */
export function prevDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return '';
  const t = new Date(Date.UTC(y, m - 1, d) - 86_400_000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** FNV-1a 32-bit — tiny, deterministic, good enough to spread dates over the catalog. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Catalog index of the daily track for a given date string. */
export function dailyIndex(date: string, count: number): number {
  if (count <= 0) return -1;
  return hashString(`neon-tap-daily:${date}`) % count;
}

/** Id of the daily track, or null for an empty catalog. */
export function dailyTrackId(date: string, catalogIds: readonly string[]): string | null {
  const i = dailyIndex(date, catalogIds.length);
  return i < 0 ? null : catalogIds[i];
}

export function isDailyDone(daily: DailyState, date: string): boolean {
  return daily.done && daily.date === date;
}

/**
 * Claim today's daily bonus star. Idempotent per day: a second completion on the same date
 * grants nothing. The streak grows only when yesterday's daily was completed too.
 */
export function completeDaily(save: SaveData, date: string): { save: SaveData; granted: boolean } {
  if (isDailyDone(save.daily, date)) return { save, granted: false };
  const continues = save.daily.done && save.daily.date === prevDate(date);
  const daily: DailyState = {
    date,
    done: true,
    streak: continues ? save.daily.streak + 1 : 1,
    total: save.daily.total + 1,
  };
  return { save: { ...save, daily }, granted: true };
}
