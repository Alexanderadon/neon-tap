import { describe, expect, it } from 'vitest';
import {
  BUDGETS,
  FAST_RATE,
  MAX_STARS,
  budgetFeatures,
  failsAt,
  foldBpm,
  gapSlots,
  rateStarsBudget,
  songEnergy,
  targetStars,
  type BudgetFeatures,
} from './budget';
import { assertPlayable, minEventGap, sameLaneClose, spinnerOverlap, worstWindowStars } from './playability';
import { LEVEL_RATES } from '@/features/play-chart/model/levels';
import type { ChartLevel, NoteTuple } from '@/shared/types/chart';

/** A sixteenth at `bpm`, in song seconds. */
const slotSec = (bpm: number) => 15 / bpm;

/** `perBar` evenly spaced taps per bar for `bars` bars at `bpm`, lanes cycling over 4. */
function clickChart(bpm: number, perBar: number, bars: number): { notes: NoteTuple[]; barTimes: number[] } {
  const barSec = 240 / bpm;
  const notes: NoteTuple[] = [];
  const barTimes: number[] = [];
  for (let b = 0; b < bars; b++) {
    barTimes.push(Math.round(b * barSec * 1000) / 1000);
    for (let k = 0; k < perBar; k++) notes.push([Math.round((b * barSec + (k * barSec) / perBar) * 1000) / 1000, (b * perBar + k) % 4]);
  }
  barTimes.push(Math.round(bars * barSec * 1000) / 1000);
  return { notes, barTimes };
}

/** A chart that fits ★3 with air to spare — the base for the one-feature-over tests. */
const FITS_3: BudgetFeatures = {
  meanNps: 1.5,
  peak1s: 2,
  peak4s: 2,
  peak8s: 2,
  minGapSec: 0.4,
  gaps: [0.4, 0.5, 0.4, 0.5],
  eighthShare: 0,
  sixteenthShare: 0,
  maxPerBar: 4,
  maxLanes: 4,
  chordsPerBarMax: 0,
  chordsPerPhraseMax: 0,
  circlesPerBarMax: 0,
  circleWindows: 0,
  rollsPerPhraseMax: 0,
  slidesPerPhraseMax: 1,
  spinners: 1,
  sameLaneCloseSec: 1,
  events: 100,
};

describe('gapSlots', () => {
  it('widens the eighth grid to beats where an eighth is shorter than the ★ gap', () => {
    // ★6 (0.19 s): eighths up to 157 BPM, beats above.
    expect(gapSlots(BUDGETS[6], slotSec(157))).toBe(2);
    expect(gapSlots(BUDGETS[6], slotSec(160))).toBe(4);
    expect(gapSlots(BUDGETS[6], slotSec(207))).toBe(4);
    // ★4 (0.26 s): eighths up to 115 BPM.
    expect(gapSlots(BUDGETS[4], slotSec(115))).toBe(2);
    expect(gapSlots(BUDGETS[4], slotSec(140))).toBe(4);
    expect(gapSlots(BUDGETS[4], slotSec(100))).toBe(2);
    // ★1 (0.40 s): an eighth at 70 BPM is 0.43 s, so eighths are legal; at 100 BPM it is beats.
    expect(gapSlots(BUDGETS[1], slotSec(70))).toBe(2);
    expect(gapSlots(BUDGETS[1], slotSec(100))).toBe(4);
    expect(gapSlots(BUDGETS[1], slotSec(140))).toBe(4);
  });

  it('never returns an odd gap: sixteenth pairs do not exist at any ★', () => {
    for (const s of [1, 2, 3, 4, 5, 6] as const) for (const bpm of [70, 100, 140, 160, 207]) expect(gapSlots(BUDGETS[s], slotSec(bpm)) % 2).toBe(0);
  });
});

describe('failsAt', () => {
  it('reports nothing for a chart inside the budget and exactly one reason per feature over it', () => {
    expect(failsAt(FITS_3, 3)).toEqual([]);
    const over: Partial<BudgetFeatures>[] = [
      { peak8s: 2.4 },
      { peak4s: 2.6 },
      { peak1s: 3.5 },
      { minGapSec: 0.2 },
      { maxPerBar: 5 },
      { maxLanes: 5 },
      { chordsPerBarMax: 1 },
      { chordsPerPhraseMax: 1 },
      { circlesPerBarMax: 4 },
      { circleWindows: 3 },
      { rollsPerPhraseMax: 1 },
      { slidesPerPhraseMax: 2 },
      { spinners: 2 },
    ];
    for (const patch of over) expect(failsAt({ ...FITS_3, ...patch }, 3), JSON.stringify(patch)).toHaveLength(1);
  });

  it('allows an isolated pickup pair but not a run of close gaps', () => {
    const pair = { ...FITS_3, minGapSec: 0.25, gaps: [0.5, 0.25, 0.5, 0.5] };
    expect(failsAt(pair, 3)).toEqual([]);
    const run = { ...FITS_3, minGapSec: 0.25, gaps: [0.5, 0.25, 0.25, 0.5] };
    expect(failsAt(run, 3)).toHaveLength(1);
    expect(failsAt(run, 3)[0]).toMatch(/close runs/);
    // At ★1 the pair itself is already too close: no pairs below ★3.
    expect(failsAt(pair, 1).some((why) => /minGap/.test(why))).toBe(true);
  });

  it('treats mean nps and the same-lane gap as readouts, not ★ criteria', () => {
    expect(failsAt({ ...FITS_3, meanNps: 9, sameLaneCloseSec: 0.1 }, 3)).toEqual([]);
  });
});

describe('rateStarsBudget', () => {
  it('rates a 140 BPM four-to-the-bar click ★3–4 and a sixteenth stream as fitting nothing', () => {
    const click = clickChart(140, 4, 40);
    const rated = rateStarsBudget(click.notes, 140, [[0, 4]], click.barTimes);
    expect(rated.stars).toBeGreaterThanOrEqual(3);
    expect(rated.stars).toBeLessThanOrEqual(4);
    expect(rated.features.maxPerBar).toBe(4);
    const stream = clickChart(140, 16, 20);
    expect(rateStarsBudget(stream.notes, 140, [[0, 4]], stream.barTimes).stars).toBe(MAX_STARS + 1);
  });

  it('rates an empty or one-note chart ★1', () => {
    expect(rateStarsBudget([], 120).stars).toBe(1);
    expect(rateStarsBudget([[1, 0]], 120).stars).toBe(1);
  });

  it('weighs a chord as one and a half taps and ignores spinners', () => {
    const notes: NoteTuple[] = [
      [0, 0],
      [0, 3],
      [1, 1],
      [2, 0, 4, 'spin'],
    ];
    const f = budgetFeatures(notes, 120);
    expect(f.events).toBe(2);
    expect(f.peak4s).toBeCloseTo(2.5 / 4);
  });

  it('counts chords per bar and phrase, circles per bar and circle windows from the bar grid', () => {
    const barTimes = Array.from({ length: 41 }, (_, b) => b * 2);
    const notes: NoteTuple[] = [];
    const circleBars = [8, 9, 30, 31];
    for (let b = 0; b < 40; b++) if (!circleBars.includes(b)) for (let k = 0; k < 4; k++) notes.push([b * 2 + k * 0.5, k]);
    // Two chords in bar 5 (one phrase); bars 8–9 and 30–31 are circle windows on the beats 0 and 2.
    notes.push([10, 3], [10.5, 3]);
    for (const b of circleBars) for (const k of [0, 2]) notes.push([b * 2 + k * 0.5, 0, 0, 'circle']);
    const f = budgetFeatures(notes, 120, [[0, 4]], barTimes);
    expect(f.chordsPerBarMax).toBe(2);
    expect(f.chordsPerPhraseMax).toBe(2);
    expect(f.circlesPerBarMax).toBe(2);
    expect(f.circleWindows).toBe(2);
    expect(f.maxPerBar).toBe(4);
  });
});

describe('targetStars', () => {
  const calm = { clearPerSec: 1, intenseShare: 0, bpmFolded: 90 };
  const wild = { clearPerSec: 4.5, intenseShare: 1, bpmFolded: 160 };

  it('grows with every energy feature and stays inside 1–6', () => {
    expect(songEnergy(calm)).toBe(0);
    expect(songEnergy(wild)).toBe(1);
    expect(songEnergy({ ...calm, clearPerSec: 3 })).toBeGreaterThan(songEnergy(calm));
    expect(songEnergy({ ...calm, intenseShare: 0.5 })).toBeGreaterThan(songEnergy(calm));
    expect(songEnergy({ ...calm, bpmFolded: 140 })).toBeGreaterThan(songEnergy(calm));
    expect(targetStars(calm, 'normal')).toBe(2);
    expect(targetStars(wild, 'normal')).toBe(MAX_STARS);
  });

  it('is clamped by the chapter and overridden per track', () => {
    expect(targetStars(wild, 'easy')).toBe(2);
    expect(targetStars(calm, 'easy')).toBe(1);
    expect(targetStars(wild, 'medium')).toBe(4);
    expect(targetStars(calm, 'medium')).toBe(3);
    expect(targetStars(calm, 'normal', 5)).toBe(5);
    expect(targetStars(wild, 'easy', 9)).toBe(MAX_STARS);
  });

  it('folds the tempo octave so a doubled grid does not change the felt tempo', () => {
    expect(foldBpm(207)).toBeCloseTo(103.5);
    expect(foldBpm(60)).toBe(120);
    expect(foldBpm(128)).toBe(128);
  });
});

describe('FAST_RATE', () => {
  it('is the fastest level of the game', () => {
    expect(FAST_RATE).toBe(LEVEL_RATES[LEVEL_RATES.length - 1]);
  });
});

describe('assertPlayable', () => {
  const stepSec = 0.125;
  const chart = (notes: NoteTuple[], stars = 3): ChartLevel => ({ stars, notes, sections: [[0, 4]] });

  it('throws on two notes in one lane 0.2 s apart and names them', () => {
    const bad = chart([
      [1, 0],
      [1.2, 0],
      [2, 3],
    ]);
    expect(sameLaneClose(bad.notes)).toHaveLength(1);
    expect(() => assertPlayable(bad, stepSec)).toThrow(/lane 0/);
  });

  it('throws on events closer than the ★ allows, a note under a spinner and a third finger', () => {
    expect(
      minEventGap([
        [1, 0],
        [1.2, 1],
        [2, 2],
      ]),
    ).toBeCloseTo(0.2);
    expect(() =>
      assertPlayable(
        chart(
          [
            [1, 0],
            [1.2, 1],
            [2, 2],
          ],
          3,
        ),
        stepSec,
      ),
    ).toThrow(/allows 0.23/);
    const spun = chart([
      [1, 0],
      [2, 0, 4, 'spin'],
      [3, 1],
      [7, 2],
    ]);
    expect(spinnerOverlap(spun.notes)).toHaveLength(1);
    expect(() => assertPlayable(spun, stepSec)).toThrow(/spinner/);
    expect(() =>
      assertPlayable(
        chart([
          [1, 0],
          [1, 1],
          [1, 2],
          [2, 3],
        ]),
        stepSec,
      ),
    ).toThrow(/fingers/);
  });

  it('passes a plain alternating chart', () => {
    const ok = chart(
      Array.from({ length: 16 }, (_, i): NoteTuple => [1 + i * 0.5, i % 2 ? 3 : 0]),
      3,
    );
    expect(() => assertPlayable(ok, stepSec)).not.toThrow();
    expect(worstWindowStars(ok.notes, 120)).toBeLessThanOrEqual(3);
  });
});
