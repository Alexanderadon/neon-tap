import { progressStore, recordResult, starsForTrack } from '@/entities/progress';
import { recordAttempt } from '@/entities/history';
import { setSessionResult, type ChartSource } from '@/entities/play-session';
import type { PlayResult } from '@/entities/score';

/**
 * Persist a finished run (built-in tracks only — custom songs are session-only, failed runs
 * never count towards the best result but do land in the attempt history) and stash result +
 * celebration metadata for the result screen.
 */
export function saveResult(result: PlayResult, source: ChartSource): { newRecord: boolean; starsBefore: number; starsAfter: number } {
  if (source === 'catalog') {
    recordAttempt(result.trackId, {
      at: new Date().toISOString(),
      score: result.score,
      accuracy: result.accuracy,
      rank: result.rank,
      maxCombo: result.maxCombo,
      failed: result.failed,
    });
  }
  if (source !== 'catalog' || result.failed) {
    const meta = { newRecord: false, starsBefore: 0, starsAfter: 0 };
    setSessionResult(result, meta);
    return meta;
  }
  const starsBefore = starsForTrack(progressStore.get().tracks[result.trackId]);
  const newRecord = recordResult(result.trackId, {
    score: result.score,
    accuracy: result.accuracy,
    rank: result.rank,
    maxCombo: result.maxCombo,
    fullCombo: result.fullCombo,
    playedAt: new Date().toISOString(),
  });
  const starsAfter = starsForTrack(progressStore.get().tracks[result.trackId]);
  const meta = { newRecord, starsBefore, starsAfter };
  setSessionResult(result, meta);
  return meta;
}
