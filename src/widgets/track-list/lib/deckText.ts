import { dict, fmt, plural } from '@/shared/i18n';
import { daysUntil, type DropState } from '@/entities/track';
import { songLimit } from '@/entities/custom-song';

/**
 * A drop not out yet: «Выйдет сегодня» / «Выйдет завтра» / «Выйдет через 3 дн.» — calendar days on
 * the player's clock to the day Monday 00:00 Moscow falls on there, no countdown. `offsetMs` for tests.
 */
export function dropSoonText(drop: Pick<DropState, 'releaseAt'>, nowMs: number, offsetMs?: (ms: number) => number): string {
  const days = daysUntil(drop.releaseAt, nowMs, offsetMs);
  if (days <= 0) return dict.dropSoonToday;
  return days === 1 ? dict.dropSoonTomorrow : fmt(dict.dropSoonDays, { n: days });
}

/** «N песен» for the saved-song count. */
export function songsText(n: number): string {
  return fmt(dict.deckSongs, { n, noun: plural(n, dict.libSongsNoun) });
}

/**
 * The «Моя музыка» card's line: what it does while nothing is saved, then the count —
 * «3 песни · осталось 0 из 3» without NEON PASS, «37 песен · PASS» with it.
 */
export function customSongsLine(count: number, pass: boolean): string {
  if (count <= 0) return dict.deckCustomLine;
  const limit = songLimit(pass);
  if (limit === null) return fmt(dict.deckSongsPass, { songs: songsText(count) });
  return fmt(dict.deckSongsLeft, { songs: songsText(count), left: Math.max(0, limit - count), limit });
}
