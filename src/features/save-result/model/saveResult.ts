import { now as clockNow } from '@/shared/lib/time';
import {
  DAILY_TRACK_CRYSTALS,
  FIRST_CROWN_CRYSTALS,
  FIRST_STARS_CRYSTALS,
  claimCompletedGoals,
  completeDailyToday,
  dailyTrackId,
  localDateString,
  progressStore,
  recordCalendarMark,
  recordCrystals,
  recordResult,
  recordRun,
  recordRunCrystals,
  starsForTrack,
} from '@/entities/progress';
import { recordAttempt } from '@/entities/history';
import { isPassActive } from '@/entities/pass';
import { TRACK_IDS } from '@/entities/track';
import { sessionStore, setSessionResult, type ChartSource, type ResultMeta } from '@/entities/play-session';
import type { PlayResult } from '@/entities/score';
import { customResultMeta } from './customResult';

const NO_META: ResultMeta = { newRecord: false, starsBefore: 0, starsAfter: 0 };

/** Crystals for reaching three stars and the first crown on a track, once each (the stars and crowns never go down). */
export function firstClearCrystals(starsBefore: number, starsAfter: number, crownsBefore: number, crownsAfter: number): number {
  return (starsBefore < 3 && starsAfter >= 3 ? FIRST_STARS_CRYSTALS : 0) + (crownsBefore <= 0 && crownsAfter > 0 ? FIRST_CROWN_CRYSTALS : 0);
}

/**
 * Persist a finished run and stash result + celebration metadata for the result screen.
 *  - every catalog run (failed too) lands in the local attempt history;
 *  - failed runs never count otherwise (no counters, no bests, no crystals, no calendar mark);
 *  - custom songs are session-only, but their combo/plays still feed the goals;
 *  - built-in tracks update the best result, the daily bonus (once per local day, a star and
 *    DAILY_TRACK_CRYSTALS), first-clear crystals (three stars, the first crown) and claim any goal;
 *  - the run's own crystals go through the daily allowance (NEON PASS × 1.5 up to its larger one;
 *    own songs under a minute pay nothing and have a daily cap);
 *  - the day's first passed run makes the login calendar's mark.
 * `now` is injectable so the daily logic is testable.
 */
export function saveResult(result: PlayResult, source: ChartSource, now: Date = new Date(clockNow())): ResultMeta {
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

  const date = localDateString(now);
  const pass = isPassActive();
  let meta: ResultMeta;
  if (source !== 'catalog') {
    meta = { ...customResultMeta(result, now.getTime()) };
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
    const passed = result.stars > 0;
    const dailyBonus = passed && dailyTrackId(date, TRACK_IDS) === result.trackId ? completeDailyToday(date) : false;
    meta = { newRecord, starsBefore, starsAfter, crownsBefore, crownsAfter, dailyBonus, bestBefore };
    if (dailyBonus) meta.dailyCrystals = DAILY_TRACK_CRYSTALS;
    const firstClear = firstClearCrystals(starsBefore, starsAfter, crownsBefore, crownsAfter);
    if (firstClear > 0) meta.firstClear = firstClear;
  }

  // The run's own crystals, through the day's allowance. An own song's length is the run's time over its passes.
  const songSeconds = result.duration / Math.max(1, result.level);
  const earned = recordRunCrystals({ raw: result.crystals, date, pass, custom: source !== 'catalog' ? { seconds: songSeconds } : undefined });
  if (earned.capped) meta.capped = earned.capped;

  const mark = recordCalendarMark(date);
  if (mark) meta.calendar = mark;

  // Bonuses outside the allowance (the calendar credits its own mark).
  const bonus = (meta.dailyCrystals ?? 0) + (meta.firstClear ?? 0);
  recordCrystals(bonus);
  const total = earned.credited + bonus + (mark?.reward ?? 0);
  if (total > 0) meta.crystals = total;

  const goals = claimCompletedGoals();
  if (goals.length) meta.goalsCompleted = goals.map((g) => g.id);
  setSessionResult(result, meta);
  return meta;
}
