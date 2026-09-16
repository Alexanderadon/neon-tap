import { describe, expect, it } from 'vitest';
import { composeChart, type ComposeTrace } from './ChartGenerator';
import { BUDGETS, budgetFeatures, failsAt, type Budget } from './budget';
import { STEPS_PER_BAR, type Slot, type SongAnalysis } from './SongAnalyzer';
import { assertPlayable, fakeAnalysis, minEventGap } from './playability';
import { rateStars } from './stars';
import type { Layer, LayerStrengths, StemLayers } from './layers';
import type { ChartLevel, NoteTuple } from '@/shared/types/chart';

/**
 * Property tests of the composer under every ★ budget: whatever the song, the chart it ships fits
 * the target it was composed for, obeys every rule of §B and is playable with two thumbs.
 */

type Stars = 1 | 2 | 3 | 4 | 5 | 6;
const STARS: readonly Stars[] = [1, 2, 3, 4, 5, 6];

/** Stem layers from per-slot onset and energy rules. */
function fakeLayers(
  bars: number,
  onsetOf: (layer: Layer, bar: number, step: number) => number,
  energyOf: (layer: Layer, bar: number, step: number) => number,
): StemLayers {
  const n = bars * STEPS_PER_BAR;
  const onset = {} as LayerStrengths;
  const energy = {} as LayerStrengths;
  for (const l of ['vocals', 'drums', 'bass', 'other'] as const) {
    onset[l] = new Float32Array(n);
    energy[l] = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      onset[l][i] = onsetOf(l, Math.floor(i / STEPS_PER_BAR), i % STEPS_PER_BAR);
      energy[l][i] = energyOf(l, Math.floor(i / STEPS_PER_BAR), i % STEPS_PER_BAR);
    }
  }
  return { onset, energy };
}

/** A drum loop with a quiet verse (bars 0–7, 24–31) and a loud drop; eighths in the drop. */
const drumLoop = (bar: number, step: number): Partial<Slot> => {
  const loud = bar % 24 >= 8;
  if (step % 4 === 0) return { strength: 1, low: 0.7, mid: 0.2, high: 0.1 };
  if (step % 2 === 0) return { strength: loud ? 0.8 : 0.45, low: 0.1, mid: 0.3, high: 0.6 };
  return { strength: loud ? 0.6 : 0.05, low: 0.1, mid: 0.3, high: 0.6 };
};
/** The same loop with a sixteenth fill closing every fourth bar. */
const fillLoop = (bar: number, step: number): Partial<Slot> =>
  bar % 4 === 3 && step >= 12 ? { strength: 0.95, low: 0.4, mid: 0.4, high: 0.2 } : drumLoop(bar, step);
/** A band: kicks on the beats, a streaming hi-hat in the drop, a pad that rings a bar, a bass on the beats — with a real breakdown at bars 32–34. */
const band = (bars: number): { analysis: SongAnalysis; layers: StemLayers } => {
  const breakdown = (bar: number) => bar >= 32 && bar < 35;
  const loud = (bar: number) => bar % 24 >= 8 && !breakdown(bar);
  const analysis = fakeAnalysis(bars, (bar, step) => {
    if (breakdown(bar)) return { strength: step === 0 ? 0.15 : 0.02, low: 0.2, mid: 0.6, high: 0.2 };
    return drumLoop(loud(bar) ? 8 : 0, step);
  });
  const layers = fakeLayers(
    bars,
    (l, bar, step) => {
      if (breakdown(bar)) return l === 'other' && step === 0 ? 0.6 : 0;
      if (l === 'drums') return step % 4 === 0 ? 1 : loud(bar) && step % 2 === 0 ? 0.7 : 0.1;
      if (l === 'bass') return step % 4 === 0 ? 0.9 : 0;
      if (l === 'other') return step === 0 || step === 8 ? 1 : 0;
      return 0;
    },
    (l, bar, step) => {
      if (l === 'vocals') return 0.02;
      if (l === 'other') return breakdown(bar) ? 0.6 : step % 8 < 6 ? 1 : 0.3;
      if (l === 'bass') return step % 4 < 2 ? 1 : 0.1;
      return breakdown(bar) ? 0.05 : 1;
    },
  );
  return { analysis, layers };
};

const barTimesOf = (bars: number, bpm = 120): number[] => Array.from({ length: bars + 1 }, (_, b) => Math.round(((b * 240) / bpm) * 1000) / 1000);
const isHold = (n: NoteTuple): boolean => n.length >= 3 && (n[2] as number) > 0 && n[3] !== 'roll' && n[3] !== 'spin';
/** Note times are rounded to a millisecond: a bar start may sit a hair before the bar's exact time. */
const barOf = (t: number, bpm = 120): number => Math.floor((t * bpm) / 240 + 1e-3);
const stepOf = (t: number, bpm = 120): number => Math.round((t * bpm) / 15) % STEPS_PER_BAR;

/** Everything §B asks of a finished chart at a given ★, in one place. */
function expectFits(chart: ChartLevel, trace: ComposeTrace, target: Stars, bars: number, bpm = 120): void {
  const b: Budget = BUDGETS[target];
  const barTimes = barTimesOf(bars, bpm);
  const lane = chart.notes.filter((n) => n[3] !== 'spin');
  expect(chart.stars).toBeLessThanOrEqual(target);
  expect(trace.target).toBe(target);
  expect(rateStars(chart.notes, bpm, chart.sections, barTimes)).toBeLessThanOrEqual(target);
  expect(failsAt(budgetFeatures(chart.notes, bpm, chart.sections, barTimes), chart.stars)).toEqual([]);
  expect(minEventGap(lane)).toBeGreaterThanOrEqual((b.pairMinSec || b.minGapSec) - 1e-9);
  expect(() => assertPlayable(chart, 15 / bpm)).not.toThrow();
  // Holds ring at least a beat; rolls last ≥ 0.7 s with 3–4 taps at ≤ 5 a second, only from ★4.
  for (const n of lane.filter(isHold)) expect(n[2]).toBeGreaterThanOrEqual(60 / bpm - 1e-6);
  const rolls = lane.filter((n) => n[3] === 'roll');
  if (b.rollsPerPhrase === 0) expect(rolls).toEqual([]);
  for (const r of rolls) {
    expect(r[2]).toBeGreaterThanOrEqual(0.7 - 1e-9);
    expect(r[4]).toBeGreaterThanOrEqual(3);
    expect(r[4]).toBeLessThanOrEqual(4);
    expect((r[4] as number) / (r[2] as number)).toBeLessThanOrEqual(5 + 1e-9);
  }
  // Chords: one per bar, two per phrase, none below ★5.
  const chordBars = new Map<number, number>();
  for (const t of new Set(lane.map((n) => n[0]))) {
    if (lane.filter((n) => n[0] === t).length < 2) continue;
    chordBars.set(barOf(t, bpm), (chordBars.get(barOf(t, bpm)) ?? 0) + 1);
  }
  if (b.chordsPerBar === 0) expect(chordBars.size).toBe(0);
  for (const n of chordBars.values()) expect(n).toBeLessThanOrEqual(1);
  const chordPhrases = new Map<number, number>();
  for (const [bar, n] of chordBars) chordPhrases.set(bar >> 2, (chordPhrases.get(bar >> 2) ?? 0) + n);
  for (const n of chordPhrases.values()) expect(n).toBeLessThanOrEqual(2);
  // Circles: on beats, at most the ★'s count per bar, never on the song's first loud transition.
  const circles = lane.filter((n) => n[3] === 'circle');
  const circleBars = new Map<number, number>();
  for (const c of circles) {
    expect(stepOf(c[0], bpm) % 4).toBe(0);
    circleBars.set(barOf(c[0], bpm), (circleBars.get(barOf(c[0], bpm)) ?? 0) + 1);
  }
  for (const n of circleBars.values()) expect(n).toBeLessThanOrEqual(b.circlesPerBar);
  const firstDrop = trace.levels.findIndex((l, p) => p > 0 && l === 2 && trace.levels[p - 1] < 2);
  if (firstDrop > 0) for (const c of circles) expect(barOf(c[0], bpm) >> 2, `circle at ${c[0]} on the first drop`).not.toBe(firstDrop);
  // Sections: 3–5 lanes, 8-bar blocks, at least 8 bars each.
  const sections = chart.sections!;
  expect(sections[0][0]).toBe(0);
  for (let i = 0; i < sections.length; i++) {
    expect(sections[i][1]).toBeGreaterThanOrEqual(3);
    expect(sections[i][1]).toBeLessThanOrEqual(5);
    if (i === 0) continue;
    const bar = Math.round((sections[i][0] * bpm) / 240);
    expect(bar % 8).toBe(0);
    expect(bar - Math.round((sections[i - 1][0] * bpm) / 240)).toBeGreaterThanOrEqual(8);
  }
}

describe('composeChart under every budget', () => {
  const songs: { name: string; analysis: SongAnalysis; layers?: StemLayers; bars: number }[] = [
    { name: 'drum loop', analysis: fakeAnalysis(48, drumLoop), bars: 48 },
    { name: 'fills', analysis: fakeAnalysis(48, fillLoop), bars: 48 },
    { name: 'band', ...band(64), bars: 64 },
  ];

  for (const target of STARS) {
    it(`★${target}: every chart fits its target, obeys the mechanics caps and is playable`, () => {
      for (const song of songs) {
        let trace: ComposeTrace | undefined;
        const chart = composeChart(song.analysis, { targetStars: target, layers: song.layers, seed: 11, onTrace: (t) => (trace = t) });
        expect(chart.notes.length, song.name).toBeGreaterThan(song.bars);
        expectFits(chart, trace!, target, song.bars);
        expect(composeChart(song.analysis, { targetStars: target, layers: song.layers, seed: 11 })).toEqual(chart);
      }
    });
  }

  it('honours the chapter ranges and a per-track override', () => {
    const { analysis, layers } = band(48);
    const stars = (chapter: 'easy' | 'medium' | 'normal', override?: number) => {
      let trace: ComposeTrace | undefined;
      composeChart(analysis, { chapter, layers, targetStars: override, onTrace: (t) => (trace = t) });
      return trace!.target;
    };
    expect(stars('easy')).toBeGreaterThanOrEqual(2);
    expect(stars('easy')).toBeLessThanOrEqual(3);
    expect(stars('medium')).toBeGreaterThanOrEqual(3);
    expect(stars('medium')).toBeLessThanOrEqual(5);
    expect(stars('normal')).toBeGreaterThanOrEqual(2);
    expect(stars('normal', 3)).toBe(3);
    expect(stars('easy', 9)).toBe(6);
  });
});

describe('compose and shrink', () => {
  it('thins a wall of eighths on every stem by whole figure steps until the ★6 windows hold', () => {
    // 150 BPM: an eighth (0.2 s) is legal at ★6, so the figure wants seven eighths a bar — 4.4/s, far over the 3.3/s window.
    const bars = 32;
    const analysis = fakeAnalysis(bars, (_bar, step) => ({ strength: step % 4 === 0 ? 1 : step % 2 === 0 ? 0.9 : 0.05, low: 0.5, mid: 0.3, high: 0.4 }), 150);
    const layers = fakeLayers(
      bars,
      (_l, _bar, step) => (step % 2 === 0 ? 1 : 0),
      (l, _bar, step) => (l === 'drums' ? 1 : step % 2 === 0 ? 1 : 0.1),
    );
    let trace: ComposeTrace | undefined;
    // No rolls: they would replace the second half of some bars and hide which steps the shrink removed.
    const chart = composeChart(analysis, { targetStars: 6, layers, rolls: 'none', onTrace: (t) => (trace = t) });
    expect(chart.stars).toBeLessThanOrEqual(6);
    expect(trace!.shrinks).toBeGreaterThanOrEqual(1);
    expect(trace!.repairs).toBe(0);
    expectFits(chart, trace!, 6, bars, 150);
    // Thinning removed a whole step: every bar of a phrase plays the same step set (its figure).
    const plain = chart.notes.filter((n) => !n[3] || n[3] === 'heart' || n[3] === 'slow');
    for (let p = 0; p < bars / 4; p++) {
      const sets = [0, 1, 2, 3].map((k) =>
        [...new Set(plain.filter((n) => barOf(n[0], 150) === p * 4 + k).map((n) => stepOf(n[0], 150)))].sort((a, b) => a - b).join(','),
      );
      expect(sets[0].length, `phrase ${p}`).toBeGreaterThan(0);
      for (const s of sets) expect(s, `phrase ${p}`).toBe(sets[0]);
      expect(sets[0]).toBe(trace!.figures[p].join(','));
    }
  });
});

describe('the custom-song path (no stems)', () => {
  it('never makes chords, and at most one roll per phrase, at any ★', () => {
    const analysis = fakeAnalysis(48, fillLoop);
    for (const target of STARS) {
      const chart = composeChart(analysis, { targetStars: target });
      const lane = chart.notes.filter((n) => n[3] !== 'spin');
      expect(new Set(lane.map((n) => n[0])).size).toBe(lane.length);
      const rollsPerPhrase = new Map<number, number>();
      for (const r of lane.filter((n) => n[3] === 'roll')) rollsPerPhrase.set(barOf(r[0]) >> 2, (rollsPerPhrase.get(barOf(r[0]) >> 2) ?? 0) + 1);
      for (const n of rollsPerPhrase.values()) expect(n).toBeLessThanOrEqual(1);
    }
    expect(composeChart(analysis, { targetStars: 6 }).notes.some((n) => n[3] === 'roll')).toBe(true);
  });
});

describe('presence', () => {
  it('never charts a bleed stem: a 5 %-energy layer yields no tile, hold or chord however sharp its onsets', () => {
    const bars = 32;
    const analysis = fakeAnalysis(bars, (_bar, step) => ({ strength: step % 4 === 0 ? 1 : 0.02, low: 0.6, mid: 0.3, high: 0.1 }));
    // Real drums on the beats; a "vocal" at 5 % energy hitting every odd sixteenth, ringing forever.
    const layers = fakeLayers(
      bars,
      (l, _bar, step) => (l === 'drums' ? (step % 4 === 0 ? 1 : 0) : l === 'vocals' ? (step % 2 === 1 ? 1 : 0) : 0),
      (l, _bar, step) => (l === 'drums' ? (step % 4 === 0 ? 1 : 0.3) : l === 'vocals' ? 0.05 : 0.01),
    );
    const chart = composeChart(analysis, { targetStars: 6, layers });
    const lane = chart.notes.filter((n) => n[3] !== 'spin');
    expect(lane.length).toBeGreaterThan(bars * 2);
    for (const n of lane) expect(stepOf(n[0]) % 4, `note at ${n[0]}`).toBe(0);
    expect(lane.filter(isHold)).toEqual([]);
    expect(new Set(lane.map((n) => n[0])).size).toBe(lane.length);
  });
});

describe('de-smear', () => {
  it('reads a hit lit on two adjacent slots as one hit, on the louder slot', () => {
    const smeared: Record<number, number> = { 0: 0.82, 1: 0.9, 8: 0.9, 9: 0.82 };
    const analysis = fakeAnalysis(16, (_bar, step) => ({ strength: smeared[step] ?? 0 }));
    for (const target of STARS) {
      const steps = new Set(composeChart(analysis, { targetStars: target }).notes.map((n) => stepOf(n[0])));
      expect(
        [...steps].sort((a, b) => a - b),
        `★${target}`,
      ).toEqual([0, 8]);
    }
  });
});

describe('synthetic stab-kick', () => {
  it('puts four beat taps per bar on fixed lanes in every chapter, whatever the stab does a sixteenth before', () => {
    const bpm = 140;
    const bars = 32;
    const analysis = fakeAnalysis(
      bars,
      (_bar, step) => ({ strength: step % 4 === 0 ? 0.85 : step % 4 === 3 ? 0.92 : 0.03, low: 0.6, mid: 0.3, high: 0.1 }),
      bpm,
    );
    for (const chapter of ['easy', 'medium', 'normal'] as const) {
      const chart = composeChart(analysis, { chapter });
      const lane = chart.notes.filter((n) => n[3] !== 'spin' && n[3] !== 'circle');
      for (const n of lane) expect(stepOf(n[0], bpm) % 4, `${chapter}: note at ${n[0]}`).toBe(0);
      const perBar = new Map<number, number>();
      for (const n of lane) perBar.set(barOf(n[0], bpm), (perBar.get(barOf(n[0], bpm)) ?? 0) + 1);
      // Four beats a bar at 140 BPM is 2.33/s: over the ★3 8-s window (chapter two reads three), inside ★4+.
      const expected = chapter === 'easy' ? 2 : chapter === 'medium' ? 3 : 4;
      for (let b = 1; b < bars - 1; b++) expect(perBar.get(b) ?? 0, `${chapter}: bar ${b}`).toBeGreaterThanOrEqual(expected);
      // Fixed lanes: within a lane-count section the same step always lands in the same lane (on a
      // 3-lane field the middle lane belongs to either thumb, so the alternation may move a step there).
      const sections = chart.sections!;
      const sectionAt = (t: number) => sections.filter((s) => s[0] <= t + 1e-9).length;
      const lanesOfSection = (t: number) => sections.filter((s) => s[0] <= t + 1e-9).pop()![1];
      const laneOf = new Map<string, number>();
      for (const n of lane) {
        if (n[3] || lanesOfSection(n[0]) < 4) continue;
        const key = `${sectionAt(n[0])}:${stepOf(n[0], bpm)}`;
        if (laneOf.has(key)) expect(laneOf.get(key), `${chapter}: ${key}`).toBe(n[1]);
        else laneOf.set(key, n[1]);
      }
    }
  });
});
