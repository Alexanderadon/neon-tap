import { beforeEach, describe, expect, it } from 'vitest';
import type { ChartFile } from '@/shared/types/chart';
import type { PlayResult } from '@/shared/types/result';
import { dailyTrackId, localDateString, progressStore, recordSpell, resetProgress } from '@/entities/progress';
import { historyStore, playsOf, resetHistory } from '@/entities/history';
import { TRACK_IDS } from '@/entities/track';
import { sessionStore, startSession } from '@/entities/play-session';
import { saveResult } from './saveResult';

const DATE = new Date(2026, 8, 5, 12, 0, 0);
const DAY = localDateString(DATE);
const DAILY_ID = dailyTrackId(DAY, TRACK_IDS)!;
const OTHER_ID = TRACK_IDS.find((id) => id !== DAILY_ID)!;

const chartFor = (id: string, stars: number): ChartFile =>
  ({ id, title: id, artist: '', audio: '', bpm: 120, offset: 0, duration: 60, beats: [], chart: { stars, notes: [], sections: [] } }) as unknown as ChartFile;

const run = (trackId: string, over: Partial<PlayResult> = {}): PlayResult => ({
  trackId,
  score: 5000,
  accuracy: 0.92,
  rank: 'A',
  maxCombo: 40,
  totalNotes: 100,
  counts: { perfect: 80, great: 10, good: 5, miss: 5 },
  fullCombo: false,
  notesToS: 3,
  failed: false,
  hearts: 3,
  timeline: { t: [], j: [], combo: [] },
  duration: 0,
  ...over,
});

describe('saveResult', () => {
  beforeEach(() => {
    resetHistory();
    resetProgress();
  });

  it('records every catalog run in the history, failed ones too, but only passes in progress', () => {
    startSession(chartFor(OTHER_ID, 5), 'catalog');
    saveResult(run(OTHER_ID), 'catalog', DATE);
    saveResult(run(OTHER_ID, { failed: true, score: 100 }), 'catalog', DATE);
    expect(playsOf(historyStore.get(), OTHER_ID)).toBe(2);
    expect(progressStore.get().plays).toBe(1);
    expect(progressStore.get().tracks[OTHER_ID].score).toBe(5000);
    expect(sessionStore.get().result?.failed).toBe(true);
  });

  it('ignores failed runs entirely', () => {
    startSession(chartFor(OTHER_ID, 5), 'catalog');
    const meta = saveResult(run(OTHER_ID, { failed: true, rank: 'D' }), 'catalog', DATE);
    expect(meta).toEqual({ newRecord: false, starsBefore: 0, starsAfter: 0 });
    const save = progressStore.get();
    expect(save.tracks[OTHER_ID]).toBeUndefined();
    expect(save.counters.tracksPlayed).toBe(0);
    expect(sessionStore.get().resultMeta).toEqual(meta);
  });

  it('still reports a spell goal completed during a failed run', () => {
    startSession(chartFor(OTHER_ID, 5), 'catalog');
    for (let i = 0; i < 10; i++) recordSpell('slow');
    const meta = saveResult(run(OTHER_ID, { failed: true, rank: 'D' }), 'catalog', DATE);
    expect(meta.goalsCompleted).toEqual(['slow-10']);
    expect(progressStore.get().goalsClaimed).toEqual(['slow-10']);
    expect(progressStore.get().tracks[OTHER_ID]).toBeUndefined();
  });

  it('records a built-in track: best, counters, hardest track', () => {
    startSession(chartFor(OTHER_ID, 6), 'catalog');
    const meta = saveResult(run(OTHER_ID, { maxCombo: 70 }), 'catalog', DATE);
    expect(meta.newRecord).toBe(true);
    expect(meta.starsBefore).toBe(0);
    expect(meta.starsAfter).toBe(2);
    expect(meta.dailyBonus).toBe(false);
    const save = progressStore.get();
    expect(save.tracks[OTHER_ID].rank).toBe('A');
    expect(save.counters).toMatchObject({ tracksPlayed: 1, maxCombo: 70, maxTrackStars: 6 });
    expect(meta.goalsCompleted).toEqual(['star-6']);
    expect(save.goalsClaimed).toEqual(['star-6']);
  });

  it('grants the daily bonus star once per day, only on a pass', () => {
    startSession(chartFor(DAILY_ID, 4), 'catalog');
    expect(saveResult(run(DAILY_ID, { rank: 'D', accuracy: 0.5 }), 'catalog', DATE).dailyBonus).toBe(false);
    expect(progressStore.get().daily.total).toBe(0);

    expect(saveResult(run(DAILY_ID), 'catalog', DATE).dailyBonus).toBe(true);
    expect(progressStore.get().daily).toEqual({ date: DAY, done: true, streak: 1, total: 1 });

    expect(saveResult(run(DAILY_ID), 'catalog', DATE).dailyBonus).toBe(false);
    expect(progressStore.get().daily.total).toBe(1);

    const tomorrow = new Date(2026, 8, 6, 9);
    const nextDaily = dailyTrackId(localDateString(tomorrow), TRACK_IDS)!;
    startSession(chartFor(nextDaily, 4), 'catalog');
    expect(saveResult(run(nextDaily), 'catalog', tomorrow).dailyBonus).toBe(true);
    expect(progressStore.get().daily.streak).toBe(2);
  });

  it('custom songs stay session-only but still feed the counters and goals', () => {
    startSession(chartFor('my-song', 9), 'custom');
    const meta = saveResult(run('my-song', { maxCombo: 120 }), 'custom', DATE);
    expect(meta.newRecord).toBe(false);
    expect(meta.goalsCompleted).toEqual(['combo-100']);
    const save = progressStore.get();
    expect(save.tracks['my-song']).toBeUndefined();
    expect(save.counters).toMatchObject({ tracksPlayed: 1, maxCombo: 120, maxTrackStars: 0 });  });
});
