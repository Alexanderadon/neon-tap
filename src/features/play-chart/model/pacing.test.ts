import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ChartFile } from '@/shared/types/chart';
import { parseChartLevel } from '@/entities/chart';
import { GAP_COUNT, INTRO_LEAD, gapCountLeft, gapReturns, introStart, notesFrom, playingStartIndex } from './pacing';

const ROOT = new URL('../../../../', import.meta.url);
const chart = (id: string) => parseChartLevel((JSON.parse(readFileSync(new URL(`public/charts/${id}.json`, ROOT), 'utf8')) as ChartFile).chart);
const at = (...times: number[]) => times.map((time) => ({ time, duration: 0 }));

describe('introStart', () => {
  it('keeps a song whose playing starts within 8 s as it is', () => {
    expect(introStart(at(0.5, 1, 1.5, 2))).toBe(0);
    expect(introStart(at(7.9, 9, 10))).toBe(0);
    expect(introStart([])).toBe(0);
  });

  it('starts 4 s before the playing when it starts later, dropping lone notes before it', () => {
    // A lone note at 12 s (nothing for 13 s after it), the playing from 25 s.
    const notes = at(12, 25, 26, 27, 28);
    expect(playingStartIndex(notes)).toBe(1);
    expect(introStart(notes)).toBe(25 - INTRO_LEAD);
    expect(notesFrom(notes, introStart(notes)).map((n) => n.time)).toEqual([25, 26, 27, 28]);
    // The note ending a hold counts from the hold's end.
    expect(introStart([{ time: 10, duration: 3 }, ...at(20, 21)])).toBe(6);
  });

  it('treats a sparse intro as playing: a tile every 1.4 s is a warm-up, not a silence', () => {
    expect(introStart(at(0, 1.4, 2.8, 4.2, 5.6, 7, 8.4, 30, 30.2, 30.4))).toBe(0);
  });

  it('fixes the songs of the review: All Night Road from 34.4 s, Up in the Sky from 24.2 s, Elevate untouched', () => {
    const road = chart('all-night-road');
    expect(introStart(road)).toBeCloseTo(road[1].time - INTRO_LEAD, 3);
    expect(notesFrom(road, introStart(road))[0].time).toBeCloseTo(38.37, 1);
    const sky = chart('up-in-the-sky');
    expect(introStart(sky)).toBeCloseTo(sky[1].time - INTRO_LEAD, 3);
    expect(sky[1].time).toBeCloseTo(28.2, 1);
    expect(introStart(chart('elevate-instrument-tracks'))).toBe(0);
    expect(introStart(chart('battle-theme'))).toBe(0);
  });
});

describe('gapReturns / gapCountLeft', () => {
  it('marks the note after an empty stretch of 6 s or more, counted from the level start for the first one', () => {
    expect(gapReturns(at(1, 2, 9, 10, 15.9, 30))).toEqual([9, 30]);
    expect(gapReturns(at(7, 8), 0)).toEqual([7]);
    expect(gapReturns(at(27, 28), 24)).toEqual([]);
    // A hold fills its stretch.
    expect(gapReturns([{ time: 1, duration: 5 }, ...at(10)])).toEqual([]);
  });

  it('counts the last three real seconds to the note, faster levels included', () => {
    const r = [20];
    expect(gapCountLeft(r, 16.9, 1)).toBe(-1);
    expect(gapCountLeft(r, 17.5, 1)).toBeCloseTo(2.5);
    expect(gapCountLeft(r, 19.99, 1)).toBeCloseTo(0.01);
    expect(gapCountLeft(r, 20, 1)).toBe(-1);
    expect(gapCountLeft(r, 25, 1)).toBe(-1);
    // ×1.2: 3 real seconds are 3.6 song seconds.
    expect(gapCountLeft(r, 16.5, 1.2)).toBeCloseTo(3.5 / 1.2);
    expect(gapCountLeft(r, 20 - GAP_COUNT * 1.2 - 0.01, 1.2)).toBe(-1);
  });

  it('gives Battle Theme its count before the notes come back after the 12.5 s pause', () => {
    const notes = chart('battle-theme');
    const returns = gapReturns(notes, introStart(notes));
    expect(returns.some((t) => Math.abs(t - 72) < 0.5)).toBe(true);
  });
});
