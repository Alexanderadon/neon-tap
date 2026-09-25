import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartFile } from '@/shared/types/chart';
import type { PlayResult } from '@/shared/types/result';
import { dailyTrackId, findGoal, localDateString, progressStore, recordSpell, resetProgress } from '@/entities/progress';
import { historyStore, playsOf, resetHistory } from '@/entities/history';
import { TRACK_IDS } from '@/entities/track';
import { sessionStore, startSession, type ResultMeta } from '@/entities/play-session';
import { firstClearCrystals, saveResult } from './saveResult';

// NEON PASS is a page flag in the app; here the tests switch it.
const pass = vi.hoisted(() => ({ on: false }));
vi.mock('@/entities/pass', () => ({ isPassActive: () => pass.on, usePassActive: () => pass.on }));

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
  stars: 3,
  crowns: 0,
  endless: false,
  level: 3,
  hearts: 3,
  timeline: { t: [], j: [], combo: [] },
  duration: 0,
  crystals: 0,
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
    expect(meta.goalsCompleted).toContain('slow-10');
    expect(progressStore.get().goalsClaimed).toContain('slow-10');
    expect(progressStore.get().tracks[OTHER_ID]).toBeUndefined();
  });

  it('records a built-in track: best, counters, hardest track', () => {
    startSession(chartFor(OTHER_ID, 6), 'catalog');
    const meta = saveResult(run(OTHER_ID, { maxCombo: 70 }), 'catalog', DATE);
    expect(meta.newRecord).toBe(true);
    expect(meta.starsBefore).toBe(0);
    expect(meta.starsAfter).toBe(3);
    expect(meta.dailyBonus).toBe(false);
    expect(meta.bestBefore).toBeNull();
    const save = progressStore.get();
    expect(save.tracks[OTHER_ID].rank).toBe('A');
    // The next run knows the exact record it is measured against («БЫЛО N»).
    expect(saveResult(run(OTHER_ID, { score: 4000 }), 'catalog', DATE).bestBefore).toBe(5000);
    expect(save.counters).toMatchObject({ tracksPlayed: 1, maxCombo: 70, maxTrackStars: 6 });
    expect(meta.goalsCompleted).toContain('hardest-6');
    expect(save.goalsClaimed).toContain('hardest-6');
  });

  it('grants the daily bonus star once per day, only on a pass', () => {
    startSession(chartFor(DAILY_ID, 4), 'catalog');
    expect(saveResult(run(DAILY_ID, { rank: 'D', accuracy: 0.5, stars: 0, level: 1 }), 'catalog', DATE).dailyBonus).toBe(false);
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
    expect(meta.goalsCompleted).toContain('combo-100');
    const save = progressStore.get();
    expect(save.tracks['my-song']).toBeUndefined();
    expect(save.counters).toMatchObject({ tracksPlayed: 1, maxCombo: 120, maxTrackStars: 0 });
  });

  it('credits crystals for catalog and custom runs, never for failed ones', () => {
    startSession(chartFor(OTHER_ID, 5), 'catalog');
    // 7 collected + 10 for the first three stars + 5 for the calendar's first mark
    expect(saveResult(run(OTHER_ID, { crystals: 7 }), 'catalog', DATE).crystals).toBe(22);
    const s0 = progressStore.get();
    expect(s0.crystals).toBeGreaterThanOrEqual(22); // + the badges this first run pays
    expect(s0.lifetimeCrystals).toBe(s0.crystals);

    startSession(chartFor('my-song', 9), 'custom');
    const before = progressStore.get().crystals;
    expect(saveResult(run('my-song', { crystals: 3, duration: 3 * 120 }), 'custom', DATE).crystals).toBe(3);
    const afterCustom = progressStore.get().crystals;
    expect(afterCustom).toBeGreaterThanOrEqual(before + 3); // + any badge the custom run completes

    startSession(chartFor(OTHER_ID, 5), 'catalog');
    const failed = saveResult(run(OTHER_ID, { failed: true, crystals: 9 }), 'catalog', DATE);
    expect(failed.crystals).toBeUndefined();
    // only a badge the earlier rewards completed may still pay (the crystal ladder climbs one claim later)
    expect(progressStore.get().crystals).toBe(afterCustom + walletGain(failed));

    // an empty-handed pass (no first clear, the day marked already) leaves the meta line out
    expect(saveResult(run(OTHER_ID, { crystals: 0 }), 'catalog', DATE).crystals).toBeUndefined();
    expect(sessionStore.get().resultMeta?.crystals).toBeUndefined();
  });
});

/** What the wallet gained from a meta: its crystals plus the badges it completed. */
const walletGain = (meta: ResultMeta) => (meta.crystals ?? 0) + (meta.goalsCompleted ?? []).reduce((sum, id) => sum + (findGoal(id)?.reward ?? 0), 0);

describe('saveResult — economy', () => {
  beforeEach(() => {
    resetHistory();
    resetProgress();
    pass.on = false;
  });

  it('meta.crystals is everything credited apart from badges, and the wallet grows by exactly that plus the badges', () => {
    startSession(chartFor(DAILY_ID, 4), 'catalog');
    const before = progressStore.get().crystals;
    const meta = saveResult(run(DAILY_ID, { crystals: 12, crowns: 1, endless: true, level: 4 }), 'catalog', DATE);
    expect(meta).toMatchObject({ dailyBonus: true, dailyCrystals: 10, firstClear: 20, calendar: { day: 1, reward: 5 } });
    expect(meta.crystals).toBe(12 + 10 + 20 + 5);
    expect(progressStore.get().crystals - before).toBe(walletGain(meta));
    expect(progressStore.get().lifetimeCrystals).toBe(progressStore.get().crystals);
  });

  it('the daily track pays +10 crystals once a day', () => {
    startSession(chartFor(DAILY_ID, 4), 'catalog');
    expect(saveResult(run(DAILY_ID), 'catalog', DATE).dailyCrystals).toBe(10);
    const again = saveResult(run(DAILY_ID), 'catalog', DATE);
    expect(again.dailyCrystals).toBeUndefined();
    expect(again.crystals).toBeUndefined();
    // not the daily track: nothing
    startSession(chartFor(OTHER_ID, 4), 'catalog');
    expect(saveResult(run(OTHER_ID), 'catalog', DATE).dailyCrystals).toBeUndefined();
  });

  it('the first three stars and the first crown on a track pay +10 each, once', () => {
    startSession(chartFor(OTHER_ID, 5), 'catalog');
    expect(saveResult(run(OTHER_ID, { stars: 2, level: 3 }), 'catalog', DATE).firstClear).toBeUndefined();
    expect(saveResult(run(OTHER_ID, { stars: 3 }), 'catalog', DATE).firstClear).toBe(10);
    expect(saveResult(run(OTHER_ID, { stars: 3 }), 'catalog', DATE).firstClear).toBeUndefined();
    expect(saveResult(run(OTHER_ID, { stars: 3, crowns: 1, endless: true, level: 4 }), 'catalog', DATE).firstClear).toBe(10);
    expect(saveResult(run(OTHER_ID, { stars: 3, crowns: 2, endless: true, level: 5 }), 'catalog', DATE).firstClear).toBeUndefined();
    // stars that once reached three never pay again, even when a later record holds fewer
    expect(saveResult(run(OTHER_ID, { stars: 1, score: 99_999, level: 2 }), 'catalog', DATE).firstClear).toBeUndefined();
    expect(firstClearCrystals(0, 3, 0, 2)).toBe(20);
    expect(firstClearCrystals(3, 3, 1, 3)).toBe(0);
  });

  it('run crystals go through the daily allowance: 100 in full, then every fifth, with a calm «capped» note', () => {
    startSession(chartFor(OTHER_ID, 5), 'catalog');
    const first = saveResult(run(OTHER_ID, { crystals: 60, stars: 2, level: 3 }), 'catalog', DATE);
    expect(first.capped).toBeUndefined();
    expect(first.crystals).toBe(60 + 5); // + the calendar
    const second = saveResult(run(OTHER_ID, { crystals: 60, stars: 2, level: 3 }), 'catalog', DATE);
    expect(second.capped).toBe('day');
    expect(second.crystals).toBe(40 + 4);
    expect(progressStore.get().earnings).toEqual({ date: DAY, run: 120, custom: 0 });
    // a new day, a new allowance
    const tomorrow = new Date(2026, 8, 6, 9);
    const fresh = saveResult(run(OTHER_ID, { crystals: 60, stars: 2, level: 3 }), 'catalog', tomorrow);
    expect(fresh.capped).toBeUndefined();
    expect(fresh.crystals).toBe(60 + 5);
  });

  it('NEON PASS: run crystals × 1.5 up to an allowance of 150', () => {
    pass.on = true;
    startSession(chartFor(OTHER_ID, 5), 'catalog');
    const meta = saveResult(run(OTHER_ID, { crystals: 20, stars: 2, level: 3 }), 'catalog', DATE);
    expect(meta.crystals).toBe(30 + 5);
    expect(progressStore.get().earnings.run).toBe(30);
  });

  it('a run failed on the first level: no crystals, no calendar mark, the allowance untouched', () => {
    startSession(chartFor(OTHER_ID, 5), 'catalog');
    const meta = saveResult(run(OTHER_ID, { failed: true, rank: 'D', stars: 0, level: 1, crystals: 5 }), 'catalog', DATE);
    expect(meta).toEqual({ newRecord: false, starsBefore: 0, starsAfter: 0 });
    const save = progressStore.get();
    expect(save.crystals).toBe(0);
    expect(save.calendar).toEqual({ count: 0, date: '' });
    expect(save.earnings).toEqual({ date: '', run: 0, custom: 0 });
  });

  it('the login calendar: a mark for the first passed run of a day, catalog or own song', () => {
    startSession(chartFor('my-song', 5), 'custom');
    expect(saveResult(run('my-song', { duration: 180 }), 'custom', DATE).calendar).toEqual({ day: 1, reward: 5 });
    startSession(chartFor(OTHER_ID, 5), 'catalog');
    expect(saveResult(run(OTHER_ID), 'catalog', DATE).calendar).toBeUndefined();
    const skipDay = new Date(2026, 8, 8, 18); // two days later: nothing is reset
    expect(saveResult(run(OTHER_ID), 'catalog', skipDay).calendar).toEqual({ day: 2, reward: 5 });
    expect(progressStore.get().calendar).toEqual({ count: 2, date: localDateString(skipDay) });
  });

  it('own songs: nothing under a minute, at most 30 crystals a day', () => {
    startSession(chartFor('my-song', 5), 'custom');
    // a 50 s song played through three levels: 150 s of play, still a short song
    const short = saveResult(run('my-song', { crystals: 8, duration: 150, level: 3 }), 'custom', DATE);
    expect(short.capped).toBe('short');
    expect(short.crystals).toBe(5); // the calendar only
    expect(progressStore.get().earnings.custom).toBe(0);
    const credited: number[] = [];
    for (let i = 0; i < 4; i++) credited.push(saveResult(run('my-song', { crystals: 12, duration: 360, level: 3 }), 'custom', DATE).crystals ?? 0);
    expect(credited).toEqual([12, 12, 6, 0]);
    expect(sessionStore.get().resultMeta?.capped).toBe('custom');
  });
});
