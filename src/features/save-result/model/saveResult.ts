import {
  claimCompletedGoals,
  completeDailyToday,
  dailyTrackId,
  localDateString,
  progressStore,
  recordCrystals,
  recordResult,
  recordRun,
  starsForTrack,
} from '@/entities/progress';
import { recordAttempt } from '@/entities/history';
import { TRACK_IDS } from '@/entities/track';
import { sessionStore, setSessionResult, type ChartSource, type ResultMeta } from '@/entities/play-session';
import type { PlayResult } from '@/entities/score';

const NO_META: ResultMeta = { newRecord: false, starsBefore: 0, starsAfter: 0 };

/**
 * Persist a finished run and stash result + celebration metadata for the result screen.
 *  - every catalog run (failed too) lands in the local attempt history;
 *  - failed runs never count otherwise (no counters, no bests);
 *  - custom songs are session-only, but their combo/plays still feed the goals;
 *  - built-in tracks update the best result, the daily bonus (once per local day, rank ≥ C)
 *    and claim any goal the run completed;
 *  - crystals collected in any non-failed run (catalog or custom) go to the wallet.
 * `now` is injectable so the daily logic is testable.
 */
export function saveResult(result: PlayResult, source: ChartSource, now: Date = new Date()): ResultMeta {
  if (source === 'catalog') {
    recordAttempt(result.trackId, {
      at: now.toISOString(),
      score: result.score,
      accuracy: result.accuracy,
      rank: result.rank,
      maxCombo: result.maxCombo,
      failed: result.failed,
    });
  }
  if (result.failed) {
    // Nothing is recorded, but spells caught mid-run already hit the counters — a goal such as
    // "10 slowdowns" may have just completed, and the player should hear about it now.
    const meta: ResultMeta = { ...NO_META };
    const goals = claimCompletedGoals();
    if (goals.length) meta.goalsCompleted = goals.map((g) => g.id);
    setSessionResult(result, meta);
    return meta;
  }

  const chart = sessionStore.get().chart;
  const catalogChart = source === 'catalog' && chart && chart.id === result.trackId ? chart : null;
  recordRun({
    maxCombo: result.maxCombo,
    trackStars: catalogChart ? catalogChart.chart.stars : 0,
    perfects: result.counts.perfect,
    genre: catalogChart?.genre,
    custom: source !== 'catalog',
  });

  let meta: ResultMeta;
  if (source !== 'catalog') {
    meta = { ...NO_META };
  } else {
    const before = progressStore.get().tracks[result.trackId];
    const starsBefore = starsForTrack(before);
    const crownsBefore = before?.crowns ?? 0;
    const bestBefore = before ? before.score : null;
    const newRecord = recordResult(result.trackId, {
      score: result.score,
      accuracy: result.accuracy,
      rank: result.rank,
      maxCombo: result.maxCombo,
      fullCombo: result.fullCombo,
      playedAt: now.toISOString(),
      stars: result.stars,
      crowns: result.crowns,
      loop: result.endless ? result.level : 0,
    });
    const after = progressStore.get().tracks[result.trackId];
    const starsAfter = starsForTrack(after);
    const crownsAfter = after?.crowns ?? 0;
    const date = localDateString(now);
    const passed = result.stars > 0;
    const dailyBonus = passed && dailyTrackId(date, TRACK_IDS) === result.trackId ? completeDailyToday(date) : false;
    meta = { newRecord, starsBefore, starsAfter, crownsBefore, crownsAfter, dailyBonus, bestBefore };
  }

  if (result.crystals > 0) {
    recordCrystals(result.crystals);
    meta.crystals = result.crystals;
  }

  const goals = claimCompletedGoals();
  if (goals.length) meta.goalsCompleted = goals.map((g) => g.id);
  setSessionResult(result, meta);
  return meta;
}
