import {
  claimCompletedGoals,
  completeDailyToday,
  dailyTrackId,
  localDateString,
  progressStore,
  rankIndex,
  recordResult,
  recordRun,
  starsForTrack,
} from '@/entities/progress';
import { TRACK_IDS } from '@/entities/track';
import { sessionStore, setSessionResult, type ChartSource, type ResultMeta } from '@/entities/play-session';
import type { PlayResult } from '@/entities/score';

const NO_META: ResultMeta = { newRecord: false, starsBefore: 0, starsAfter: 0 };

/**
 * Persist a finished run and stash result + celebration metadata for the result screen.
 *  - failed runs never count (no counters, no bests);
 *  - custom songs are session-only, but their combo/plays still feed the goals;
 *  - built-in tracks update the best result, the daily bonus (once per local day, rank ≥ C)
 *    and claim any goal the run completed.
 * `now` is injectable so the daily logic is testable.
 */
export function saveResult(result: PlayResult, source: ChartSource, now: Date = new Date()): ResultMeta {
  if (result.failed) {
    setSessionResult(result, NO_META);
    return NO_META;
  }

  const chart = sessionStore.get().chart;
  const trackStars = source === 'catalog' && chart && chart.id === result.trackId ? chart.chart.stars : 0;
  recordRun({ maxCombo: result.maxCombo, trackStars });

  let meta: ResultMeta;
  if (source !== 'catalog') {
    meta = { ...NO_META };
  } else {
    const starsBefore = starsForTrack(progressStore.get().tracks[result.trackId]);
    const newRecord = recordResult(result.trackId, {
      score: result.score,
      accuracy: result.accuracy,
      rank: result.rank,
      maxCombo: result.maxCombo,
      fullCombo: result.fullCombo,
      playedAt: now.toISOString(),
    });
    const starsAfter = starsForTrack(progressStore.get().tracks[result.trackId]);
    const date = localDateString(now);
    const passed = rankIndex(result.rank) >= rankIndex('C');
    const dailyBonus = passed && dailyTrackId(date, TRACK_IDS) === result.trackId ? completeDailyToday(date) : false;
    meta = { newRecord, starsBefore, starsAfter, dailyBonus };
  }

  const goals = claimCompletedGoals();
  if (goals.length) meta.goalsCompleted = goals.map((g) => g.id);
  setSessionResult(result, meta);
  return meta;
}
