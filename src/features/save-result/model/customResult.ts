import { bestOfRun, findSong, mergeBest, saveBest } from '@/entities/custom-song';
import type { ResultMeta } from '@/entities/play-session';
import type { PlayResult } from '@/entities/score';

/**
 * The result metadata of a finished run on the player's own song. Its record lives with the song
 * («Моя музыка»), never in SaveData: the previous best is read synchronously from the song store,
 * the merged one is written back in the background. Own songs give no road stars (0 → 0); a song
 * played once without being saved has no record at all.
 */
export function customResultMeta(result: PlayResult, now: number): ResultMeta {
  const song = findSong(result.trackId);
  if (!song) return { newRecord: false, starsBefore: 0, starsAfter: 0 };
  const prev = song.best;
  const { best, newRecord } = mergeBest(prev, bestOfRun(result, new Date(now).toISOString()));
  void saveBest(song.id, best);
  return {
    newRecord,
    starsBefore: 0,
    starsAfter: 0,
    bestBefore: prev ? prev.score : null,
    crownsBefore: prev?.crowns ?? 0,
    crownsAfter: best.crowns,
  };
}
