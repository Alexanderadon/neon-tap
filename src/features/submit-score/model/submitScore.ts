import { leaderboard, type LeaderboardClient, type LeaderboardSubmitResult } from '@/shared/api/leaderboard';
import { isCustomId } from '@/shared/types/chart';
import type { ChartSource } from '@/entities/play-session';
import type { PlayResult } from '@/entities/score';

/** Only finished built-in tracks go online; failed runs and custom songs (by source or by their `custom:` id) stay local. */
export function isEligible(result: PlayResult | null | undefined, source: ChartSource): boolean {
  return !!result && source === 'catalog' && !isCustomId(result.trackId) && !result.failed && result.totalNotes > 0;
}

const inflight = new WeakMap<PlayResult, Promise<LeaderboardSubmitResult>>();

/**
 * Submit a result once per run: repeated calls for the same `PlayResult` object (React strict
 * mode, re-renders) share the first request instead of posting twice.
 */
export function submitScore(result: PlayResult, nickname: string, client: LeaderboardClient = leaderboard): Promise<LeaderboardSubmitResult> {
  let p = inflight.get(result);
  if (!p) {
    p = client.submit({
      track: result.trackId,
      name: nickname,
      score: result.score,
      accuracy: result.accuracy,
      rank: result.rank,
      maxCombo: result.maxCombo,
    });
    inflight.set(result, p);
  }
  return p;
}
