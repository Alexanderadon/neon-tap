import { dict, fmt, plural } from '@/shared/i18n';
import { daysUntil, type DropState } from '@/entities/track';
import { CUSTOM_FREE_LIMIT } from '@/entities/custom-song';

/** A drop not out yet: «Выйдет завтра» / «Выйдет через 3 дн.» — whole days to Monday 00:00 Moscow, no clock. */
export function dropSoonText(drop: Pick<DropState, 'releaseAt'>, nowMs: number): string {
  const days = daysUntil(drop.releaseAt, nowMs);
  return days <= 1 ? dict.dropSoonTomorrow : fmt(dict.dropSoonDays, { n: days });
}

/** «N песен» for the saved-song count. */
export function songsText(n: number): string {
  return fmt(dict.deckSongs, { n, noun: plural(n, dict.deckSongNoun) });
}

/**
 * The «Своя музыка» card's line: what it does while nothing is saved, then the count —
 * «3 песни · осталось 0 из 3» without NEON PASS, «37 песен · PASS» with it.
 */
export function customSongsLine(count: number, pass: boolean): string {
  if (count <= 0) return dict.deckCustomLine;
  if (pass) return fmt(dict.deckSongsPass, { songs: songsText(count) });
  return fmt(dict.deckSongsLeft, { songs: songsText(count), left: Math.max(0, CUSTOM_FREE_LIMIT - count), limit: CUSTOM_FREE_LIMIT });
}
