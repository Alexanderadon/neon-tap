import type { ResultMeta } from '@/entities/play-session';
import type { PlayResult } from '@/entities/score';

/**
 * The result metadata of a run on the player's own song. Placeholder: no records yet — the
 * «Моя музыка» catalog replaces the body (its records live with the song, never in SaveData).
 */
export function customResultMeta(result: PlayResult, now: number): ResultMeta {
  void result;
  void now;
  return { newRecord: false, starsBefore: 0, starsAfter: 0 };
}
