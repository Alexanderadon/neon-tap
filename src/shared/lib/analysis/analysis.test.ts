import { describe, expect, it } from 'vitest';
import { RealFFT } from './fft';
import { detectOnsets } from './OnsetDetector';
import { estimateBpm } from './BpmEstimator';
import { estimateDownbeatPhase, trackBeats } from './BeatTracker';
import { analyzeSong, STEPS_PER_BAR, type Slot } from './SongAnalyzer';
import { composeChart, type ComposeTrace } from './ChartGenerator';
import { figureOf, shrinkFigure } from './figure';
import { circleSpread } from './laneAssign';
import { chartFeatures, rateStars } from './stars';
import { synthesizeClicks } from './synthetic';
import { fakeAnalysis, handHops, isHoldType, maxFingers, minEventGap, thumbViolations } from './playability';
import { BUDGETS, MAX_STARS, budgetFeatures, failsAt } from './budget';
import type { NoteTuple } from '@/shared/types/chart';

const SR = 22050;
const BPM = 128;
const BEAT = 60 / BPM;

/** 128 BPM click track with a louder downbeat every 4 beats, 32 s. */
function clickTrack() {
  const times: number[] = [];
  const gains: number[] = [];
  for (let i = 0; i < 64; i++) {
    times.push(0.5 + i * BEAT);
    gains.push(i % 4 === 0 ? 1 : 0.5);
  }
  return { times, signal: synthesizeClicks(times, 32, SR, 42, gains) };
}

describe('RealFFT', () => {
  it('finds the peak bin of a pure sine', () => {
    const n = 1024;
    const fft = new RealFFT(n);
    const freq = 1000;
    const input = new Float32Array(n);
    for (let i = 0; i < n; i++) input[i] = Math.sin((2 * Math.PI * freq * i) / SR);
    const out = new Float32Array(n / 2 + 1);
    fft.magnitudes(input, out);
    let peak = 0;
    for (let k = 1; k < out.length; k++) if (out[k] > out[peak]) peak = k;
    expect(Math.abs(peak * (SR / n) - freq)).toBeLessThan(SR / n);
  });
});

describe('detectOnsets', () => {
  it('detects ≥ 90% of synthetic onsets within 30 ms', () => {
    const truth: number[] = [];
    for (let i = 0; i < 60; i++) truth.push(1 + i * BEAT + (i % 3 === 0 ? BEAT / 2 : 0));
    const signal = synthesizeClicks(truth, 32, SR);
    const { onsets } = detectOnsets(signal, { sampleRate: SR });
    let hits = 0;
    for (const t of truth) if (onsets.some((o) => Math.abs(o.time - t) <= 0.03)) hits++;
    expect(hits / truth.length).toBeGreaterThanOrEqual(0.9);
    expect(onsets.length).toBeLessThan(truth.length * 1.5);
  });
});

describe('estimateBpm', () => {
  it('recovers tempo of a 128 BPM click track within ±2 BPM', () => {
    const { signal } = clickTrack();
    const { flux, hopSeconds } = detectOnsets(signal, { sampleRate: SR });
    const est = estimateBpm(flux, hopSeconds);
    expect(Math.abs(est.bpm - BPM)).toBeLessThanOrEqual(2);
    expect(est.confidence).toBeGreaterThan(0.2);
  });
});

describe('trackBeats', () => {
  it('locks onto every click within 30 ms and finds the downbeat', () => {
    const { times, signal } = clickTrack();
    const det = detectOnsets(signal, { sampleRate: SR });
    const est = estimateBpm(det.flux, det.hopSeconds);
    const beats = trackBeats(det.flux, det.hopSeconds, est.bpm).map(det.frameTime);
    expect(Math.abs(beats.length - times.length)).toBeLessThanOrEqual(2);
    let matched = 0;
    for (const b of beats) if (times.some((t) => Math.abs(t - b) <= 0.03)) matched++;
    expect(matched / beats.length).toBeGreaterThanOrEqual(0.95);
    const frames = trackBeats(det.flux, det.hopSeconds, est.bpm);
    const phase = estimateDownbeatPhase(frames, det.bandFlux[0], det.flux);
    const firstDownbeat = det.frameTime(frames[phase]);
    const nearestTruthIdx = times.findIndex((t) => Math.abs(t - firstDownbeat) <= 0.03);
    expect(nearestTruthIdx % 4).toBe(0);
  });
});

describe('analyzeSong', () => {
  const { times, signal } = clickTrack();
  const analysis = analyzeSong(signal, SR);

  it('resolves the tempo octave: 64 BPM clicks stay at 64, not 128', () => {
    const slowBeat = 60 / 64;
    const truth = Array.from({ length: 40 }, (_, i) => 0.5 + i * slowBeat);
    const a = analyzeSong(synthesizeClicks(truth, 40, SR), SR);
    expect(Math.abs(a.bpm - 64)).toBeLessThanOrEqual(2);
    expect(a.beatConfidence).toBeGreaterThan(0.8);
  });

  it('builds a 16-step grid per bar, starting on a downbeat, covering the track', () => {
    expect(analysis.beats[0]).toBeLessThanOrEqual(times[0] + 0.03);
    expect(analysis.beats[analysis.beats.length - 1]).toBeGreaterThanOrEqual(times[times.length - 1] - 0.03);
    for (let i = 1; i < analysis.slots.length; i++) expect(analysis.slots[i].time).toBeGreaterThan(analysis.slots[i - 1].time);
    const bar1 = analysis.slots.filter((s) => s.bar === 1);
    expect(bar1.length).toBe(STEPS_PER_BAR);
    const downbeatStrength = analysis.slots.filter((s) => s.step === 0 && s.time > 1 && s.time < 30).map((s) => s.strength);
    expect(Math.min(...downbeatStrength)).toBeGreaterThan(0.5);
  });

  it('marks clicks as strong slots and silence as weak', () => {
    const onBeat = analysis.slots.filter((s) => s.step % 4 === 0 && s.time > 1 && s.time < 30);
    const offBeat = analysis.slots.filter((s) => s.step % 4 === 2 && s.time > 1 && s.time < 30);
    const avg = (xs: Slot[]) => xs.reduce((a, s) => a + s.strength, 0) / xs.length;
    expect(avg(onBeat)).toBeGreaterThan(0.4);
    expect(avg(offBeat)).toBeLessThan(0.15);
  });
});

/** Hand-built analysis: N bars of 16 slots at 120 BPM with a given strength/sustain pattern. */

const drumLoop = (bar: number, step: number): Partial<Slot> => {
  const intense = bar % 24 >= 8;
  if (step % 4 === 0) return { strength: 1, low: 0.7, mid: 0.2, high: 0.1 };
  if (step % 2 === 0) return { strength: intense ? 0.8 : 0.45, low: 0.1, mid: 0.3, high: 0.6 };
  return { strength: intense ? 0.6 : 0.05, low: 0.1, mid: 0.3, high: 0.6 };
};

/** Drum loop with a loud sixteenth fill on the last beat of every 4th bar. */
const fillLoop = (bar: number, step: number): Partial<Slot> => {
  if (bar % 4 === 3 && step >= 12) return { strength: 0.95, low: 0.4, mid: 0.4, high: 0.2 };
  return drumLoop(bar, step);
};

/** A ringing pad on every beat (no hits in between): the sound has room to become a hold. */
const sustainedLoop = (bar: number, step: number): Partial<Slot> => ({
  strength: step % 4 === 0 ? (bar % 24 >= 8 ? 1 : 0.7) : 0.02,
  sustain: step % 4 === 0 ? 6 : 0,
  low: 0.2,
  mid: 0.7,
  high: 0.1,
});

const stepOf = (t: number) => Math.round(t / 0.125) % STEPS_PER_BAR;
const barOf = (t: number) => Math.floor(Math.round(t / 0.125) / STEPS_PER_BAR);
/** Distinct steps of a bar's lane notes (circles and spinners excluded), ascending. */
const stepsInBar = (notes: readonly NoteTuple[], bar: number): number[] =>
  [...new Set(notes.filter((n) => n[3] !== 'spin' && n[3] !== 'circle' && barOf(n[0]) === bar).map((n) => stepOf(n[0])))].sort((a, b) => a - b);
const barTimesOf = (bars: number): number[] => Array.from({ length: bars + 1 }, (_, b) => b * 2);
const isChord = (notes: readonly NoteTuple[], n: NoteTuple): boolean => notes.some((m) => m !== n && m[0] === n[0] && m[3] !== 'spin');

describe('composeChart', () => {
  const analysis = fakeAnalysis(48, drumLoop);
  let trace: ComposeTrace | undefined;
  const chart = composeChart(analysis, { onTrace: (t) => (trace = t) });
  const slotTimes = new Set(analysis.slots.map((s) => s.time));

  it('puts every note exactly on a grid slot and never needs more than two fingers', () => {
    expect(chart.notes.length).toBeGreaterThan(0);
    for (const n of chart.notes) expect(slotTimes.has(n[0])).toBe(true);
    expect(maxFingers(chart.notes)).toBeLessThanOrEqual(2);
    expect(maxFingers(composeChart(fakeAnalysis(24, sustainedLoop)).notes)).toBeLessThanOrEqual(2);
  });

  it('keeps the free thumb on its own half while the other holds, rolls or slides, and gives it a quarter second to let go', () => {
    for (const a of [chart, composeChart(fakeAnalysis(32, sustainedLoop)), composeChart(fakeAnalysis(16, fillLoop), { targetStars: 5 })]) {
      expect(a.notes.filter(isHoldType).length).toBeGreaterThan(0);
      expect(thumbViolations(a.notes, a.sections!)).toEqual([]);
    }
  });

  it('never makes one thumb hop lanes on a sixteenth or into a long note (fast notes alternate hands)', () => {
    for (const a of [chart, composeChart(fakeAnalysis(32, sustainedLoop)), composeChart(fakeAnalysis(16, fillLoop), { targetStars: 5 })]) {
      expect(handHops(a.notes, a.sections!, 0.125)).toEqual([]);
    }
  });

  it('fits the budget of its own ★, keeps lanes and chords valid and never hammers one lane', () => {
    const { notes, sections } = chart;
    expect(failsAt(budgetFeatures(notes, 120, sections, barTimesOf(48)), chart.stars)).toEqual([]);
    const lanesAt = (t: number) => sections!.filter((s) => s[0] <= t + 1e-9).pop()![1];
    const lane = notes.filter((n) => n[3] !== 'spin');
    const starts = [...new Set(lane.map((n) => n[0]))].sort((a, b) => a - b);
    const events = starts.map((t) => lane.filter((n) => n[0] === t).map((n) => n[1]));
    for (let i = 3; i < events.length; i++)
      for (const l of events[i]) expect(events[i - 1].includes(l) && events[i - 2].includes(l) && events[i - 3].includes(l)).toBe(false);
    for (const t of starts) {
      const lanes = lane.filter((n) => n[0] === t).map((n) => n[1]);
      expect(new Set(lanes).size).toBe(lanes.length);
      expect(lanes.length).toBeLessThanOrEqual(2);
      for (const l of lanes) expect(l >= 0 && l < lanesAt(t)).toBe(true);
    }
  });

  it('draws lane counts from the budget pools (3–5, intro on 4), in sections of at least 16 bars on 8-bar boundaries', () => {
    const sections = chart.sections!;
    expect(sections[0]).toEqual([0, 4]);
    for (const [, c] of sections) expect(c >= 3 && c <= 5).toBe(true);
    for (let i = 1; i < sections.length; i++) {
      expect(sections[i][0] % 16).toBeCloseTo(0, 6);
      expect(sections[i][0] - sections[i - 1][0]).toBeGreaterThanOrEqual(32);
    }
    const lanesAt = (t: number) => sections.filter((s) => s[0] <= t + 1e-9).pop()![1];
    for (const n of chart.notes) expect(n[1]).toBeLessThan(lanesAt(n[0]));
  });

  it('leaves a beat of silence before every lane-count change', () => {
    const sections = chart.sections!;
    for (let i = 1; i < sections.length; i++) {
      const t = sections[i][0];
      const before = chart.notes.filter((n) => n[0] < t && n[0] + (n.length >= 3 ? (n[2] as number) : 0) > t - 0.5 + 1e-6);
      expect(before).toEqual([]);
    }
  });

  it('opens a real drop with a short circle-only window on the beats — never the first drop, never more than the ★ allows', () => {
    // drumLoop: quiet bars 0–7, loud 8–23, quiet 24–31, loud 32–47. The first loud transition (bar 8) stays lane notes.
    expect(chart.stars).toBeGreaterThanOrEqual(2);
    const firstDrop = chart.notes.filter((n) => n[0] >= 16 && n[0] < 20);
    expect(firstDrop.length).toBeGreaterThan(4);
    expect(firstDrop.some((n) => n[3] === 'circle')).toBe(false);
    // The second one (bars 32–33) is circles only, with one empty beat before it.
    const win = chart.notes.filter((n) => n[0] >= 64 && n[0] < 68);
    expect(win.length).toBeGreaterThanOrEqual(2);
    expect(win.every((n) => n[3] === 'circle')).toBe(true);
    expect(chart.notes.filter((n) => n[0] >= 63.5 && n[0] < 64)).toEqual([]);
    for (const c of win) expect(stepOf(c[0]) % 4).toBe(0);
    for (let i = 1; i < win.length; i++) expect(win[i][0] - win[i - 1][0]).toBeGreaterThanOrEqual(0.5 - 1e-6);
    const perBar = new Map<number, number>();
    for (const c of chart.notes.filter((n) => n[3] === 'circle')) perBar.set(barOf(c[0]), (perBar.get(barOf(c[0])) ?? 0) + 1);
    for (const n of perBar.values()) expect(n).toBeLessThanOrEqual(BUDGETS[chart.stars as 2].circlesPerBar);
    // The stream resumes right after the window: bars 34–35 are lane notes again.
    expect(chart.notes.filter((n) => n[0] >= 68 && n[0] < 72 && n[3] !== 'circle').length).toBeGreaterThan(4);
  });

  it('reproduces the phrase figure in every bar, within the ★ budget, and keeps it across same-level phrases', () => {
    // "ту ту ТУ ту ту ТУ": eighths on 0 2 4 6 8 10 with the loud ones on 4 and 10; ★6 allows six eighths per bar at 120 BPM.
    const figure: Record<number, number> = { 0: 0.6, 2: 0.6, 4: 1, 6: 0.6, 8: 0.6, 10: 1 };
    // Phrases alternate a slightly softer step 6 — still the same figure to the ear, so it must not change.
    const song = fakeAnalysis(16, (bar, step) => ({ strength: (figure[step] ?? 0) * (step === 6 && Math.floor(bar / 4) % 2 ? 0.9 : 1) }));
    let t: ComposeTrace | undefined;
    const { notes } = composeChart(song, { targetStars: 6, onTrace: (x) => (t = x) });
    for (let b = 0; b < 16; b++) expect(stepsInBar(notes, b), `bar ${b}`).toEqual([0, 2, 4, 6, 8, 10]);
    expect(t!.figures.every((f) => f.join(',') === '0,2,4,6,8,10')).toBe(true);
    expect(maxFingers(notes)).toBeLessThanOrEqual(2);
    // At ★4 an eighth (0.25 s) is under the 0.26 s gap: the same song is read on its beats, plus at most one pickup.
    const four = composeChart(song, { targetStars: 4 }).notes;
    for (let b = 0; b < 16; b++) expect(stepsInBar(four, b).filter((s) => s % 4 !== 0).length, `bar ${b}`).toBeLessThanOrEqual(1);
    expect(minEventGap(four)).toBeGreaterThanOrEqual(BUDGETS[4].pairMinSec - 1e-9);
  });

  it('never places two events closer than the ★ gap, in any chapter — no sixteenth pairs', () => {
    // "ta-ka" before beat 3 in every bar: 0 4 7 8 12 (14 softer).
    const figure: Record<number, number> = { 0: 1, 4: 0.9, 7: 0.85, 8: 1, 12: 0.9, 14: 0.7 };
    const song = fakeAnalysis(16, (_bar, step) => ({ strength: figure[step] ?? 0 }));
    for (const chapter of ['easy', 'medium', 'normal'] as const) {
      const c = composeChart(song, { chapter });
      const b = BUDGETS[c.stars as 1];
      expect(minEventGap(c.notes)).toBeGreaterThanOrEqual((b.pairMinSec || b.minGapSec) - 1e-9);
      for (let bar = 0; bar < 16; bar++) {
        const steps = stepsInBar(c.notes, bar);
        expect(steps.includes(7) && steps.includes(8), `bar ${bar}: ${steps.join(' ')}`).toBe(false);
        expect(steps).toContain(0);
      }
    }
  });

  it('keeps the beat as the figure step when a louder off-grid stab sits a sixteenth away, and de-smears a hit lit on two slots', () => {
    // A hardstyle stab one sixteenth before every kick, a touch louder than the kick itself: the tile is the kick.
    const stabbed = fakeAnalysis(16, (_bar, step) => ({ strength: step % 4 === 0 ? 0.85 : step % 4 === 3 ? 0.9 : 0.02 }), 140);
    for (const chapter of ['easy', 'medium', 'normal'] as const) {
      const c = composeChart(stabbed, { chapter });
      for (const n of c.notes) {
        const s = stabbed.slots.find((x) => Math.abs(x.time - n[0]) < 2e-3)!;
        expect(s.step % 4, `${chapter}: step ${s.step}`).toBe(0);
      }
      expect(c.notes.length).toBeGreaterThanOrEqual(16 * 2);
    }
    // A slot that is only the tail of a louder neighbour is not a hit of its own.
    const smeared: Record<number, number> = { 0: 0.9, 1: 0.82, 8: 0.9, 9: 0.82 };
    const tail = composeChart(fakeAnalysis(16, (_bar, step) => ({ strength: smeared[step] ?? 0 }))).notes;
    for (let b = 0; b < 16; b++) expect(stepsInBar(tail, b)).toEqual([0, 8]);
  });

  it("follows the song's own stream of hits: loud phrases get more per bar than quiet ones, never above the ★'s cap", () => {
    const lane = chart.notes.filter((n) => n[3] !== 'spin');
    const perBar = new Map<number, number>();
    for (const t of new Set(lane.map((n) => n[0]))) perBar.set(barOf(t), (perBar.get(barOf(t)) ?? 0) + 1);
    const mean = (bars: number[]) => bars.reduce((a, b) => a + (perBar.get(b) ?? 0), 0) / bars.length;
    expect(mean([12, 13, 14, 15, 16, 17, 18, 19])).toBeGreaterThan(mean([2, 3, 4, 5, 6, 7]));
    for (const n of perBar.values()) expect(n).toBeLessThanOrEqual(BUDGETS[chart.stars as 1].maxPerBar[2]);
    expect(trace!.levels[3]).toBe(2);
    expect(trace!.levels[1]).toBeLessThan(2);
  });

  it('turns drum streams into rolls of 3–4 taps at no more than five taps a second, only from ★4', () => {
    const rolls = composeChart(fakeAnalysis(16, fillLoop), { targetStars: 5 }).notes.filter((n) => n[3] === 'roll');
    expect(rolls.length).toBeGreaterThan(0);
    for (const r of rolls) {
      expect(r[2]).toBeGreaterThanOrEqual(0.7);
      expect(r[4]).toBeGreaterThanOrEqual(3);
      expect(r[4]).toBeLessThanOrEqual(4);
      expect((r[4] as number) / (r[2] as number)).toBeLessThanOrEqual(5 + 1e-9);
    }
    expect(composeChart(fakeAnalysis(16, fillLoop), { targetStars: 3 }).notes.some((n) => n[3] === 'roll')).toBe(false);
  });

  it('makes some two-beat holds into slides of exactly two beats that end in a free neighbouring lane', () => {
    // A pad struck on beats 1 and 4 that rings ten slots from beat 1: room for a two-beat slide before the next hit.
    const roomy = fakeAnalysis(48, (_bar, step) => ({ strength: step === 0 || step === 12 ? 1 : 0.02, sustain: step === 0 ? 10 : 0, low: 0.2, mid: 0.7 }));
    const notes = composeChart(roomy, { targetStars: 4 }).notes;
    const slides = notes.filter((n) => n[3] === 'slide');
    expect(slides.length).toBeGreaterThan(0);
    for (const s of slides) {
      expect(s[2]).toBeCloseTo(1, 6); // 8 slots at 120 BPM
      const end = s[4] as number;
      expect(end).not.toBe(s[1]);
      expect(Math.abs(end - s[1])).toBeLessThanOrEqual(2);
      const during = notes.filter((n) => n !== s && n[1] === end && n[0] > s[0] && n[0] < s[0] + (s[2] as number) - 1e-6);
      expect(during).toEqual([]);
    }
    expect(chartFeatures({ stars: 1, notes }).slides).toBe(slides.length);
  });

  it('never starts a note in a lane that is still being held, and never holds shorter than a beat', () => {
    const notes = composeChart(fakeAnalysis(24, sustainedLoop)).notes;
    const holds = notes.filter(isHoldType);
    expect(holds.length).toBeGreaterThan(0);
    for (const h of holds) {
      expect(h[2]).toBeGreaterThanOrEqual(0.5 - 1e-6);
      const end = h[0] + (h[2] as number);
      const clash = notes.some((n) => n !== h && n[1] === h[1] && n[0] > h[0] && n[0] < end - 1e-6);
      expect(clash).toBe(false);
    }
  });

  it('gets denser when the song has more hits', () => {
    const eighths = composeChart(fakeAnalysis(24, drumLoop), { targetStars: 5 }).notes.length;
    const beats = composeChart(fakeAnalysis(24, sustainedLoop), { targetStars: 5 }).notes.length;
    expect(eighths).toBeGreaterThanOrEqual(beats * 1.2);
  });

  it('gives quiet intros sparse notes but leaves true silence, pad noise and anything below the ear’s floor empty', () => {
    const intro = (level: number) =>
      fakeAnalysis(24, (bar, step) => {
        if (bar < 4) return { strength: 0 };
        if (bar < 8) return { strength: step % 8 === 0 ? level : 0.02 };
        return drumLoop(bar + 8, step);
      });
    const soft = composeChart(intro(0.35)).notes;
    expect(soft.filter((n) => n[0] < 8)).toEqual([]);
    for (let b = 4; b < 8; b++) {
      const steps = stepsInBar(soft, b);
      expect(steps.length).toBeGreaterThanOrEqual(1);
      expect(steps.length).toBeLessThanOrEqual(2);
    }
    // Hits the mix reports below 0.3 (and no stem clearly plays) are quiet tiles: the intro stays empty.
    for (const level of [0.2, 0.05]) {
      const faint = composeChart(intro(level)).notes;
      expect(faint.filter((n) => n[0] < 16)).toEqual([]);
      expect(faint.filter((n) => n[0] >= 16).length).toBeGreaterThan(0);
    }
  });

  it('places heart spells as plain taps every eight bars; slow-motion only alternates in on ★6', () => {
    // At 150 BPM an eighth (0.2 s) is legal only at ★6, and five tiles a bar overflow the ★5 windows: the chart is ★6.
    const wall = fakeAnalysis(48, (_bar, step) => ({ strength: step % 4 === 0 ? 1 : 0.8, low: 0.5, mid: 0.3, high: 0.4 }), 150);
    const hard = composeChart(wall, { targetStars: 6 });
    expect(hard.stars).toBe(6);
    const spells = hard.notes.filter((n) => n[3] === 'slow' || n[3] === 'heart');
    expect(spells.length).toBeGreaterThanOrEqual(2);
    expect(spells[0][3]).toBe('slow');
    expect(spells[1][3]).toBe('heart');
    for (const s of spells) expect(s[2]).toBe(0);
    // Below ★6 every spell slot is a heart.
    const calm = composeChart(wall, { targetStars: 4 });
    expect(calm.stars).toBeLessThan(6);
    expect(calm.notes.some((n) => n[3] === 'slow')).toBe(false);
    expect(calm.notes.filter((n) => n[3] === 'heart').length).toBeGreaterThanOrEqual(2);
    expect(
      composeChart(fakeAnalysis(48, (_bar, step) => (step % 8 === 0 ? { strength: 0.6, low: 0.6 } : { strength: 0.02 }))).notes.some((n) => n[3] === 'slow'),
    ).toBe(false);
  });

  it('reads the same song for beginners: ★1–2, a beat and a third between tiles, no mechanics, 3–4 lanes', () => {
    const easy = composeChart(analysis, { chapter: 'easy' });
    const hard = composeChart(analysis);
    expect(easy.stars).toBeLessThanOrEqual(2);
    expect(easy.stars).toBeLessThanOrEqual(hard.stars);
    expect(easy.notes.length).toBeGreaterThan(40);
    expect(easy.notes.length).toBeLessThanOrEqual(hard.notes.length);
    expect(minEventGap(easy.notes)).toBeGreaterThanOrEqual(0.36 - 1e-9);
    expect(easy.notes.some((n) => n[3] === 'roll' || n[3] === 'slide' || n[3] === 'spin' || n[3] === 'slow')).toBe(false);
    expect(easy.notes.some((n) => n[3] === 'heart')).toBe(true);
    expect(easy.notes.some((n) => isChord(easy.notes, n))).toBe(false);
    for (const [, lanes] of easy.sections!) expect(lanes === 3 || lanes === 4).toBe(true);
    expect(thumbViolations(easy.notes, easy.sections!)).toEqual([]);
  });

  it('turns a real breakdown into a spinner with an empty field around it, never for beginners', () => {
    // 8 loud bars, a 3-bar breakdown (quiet but audible), loud again — twice, 32 bars apart.
    const breakdown = (bar: number, step: number): Partial<Slot> => {
      const quiet = (bar >= 8 && bar < 11) || (bar >= 40 && bar < 43);
      if (quiet) return { strength: step % 4 === 0 ? 0.12 : 0.02, low: 0.2, mid: 0.6, high: 0.2 };
      return drumLoop(8, step); // always the loud reading of drumLoop
    };
    const song = fakeAnalysis(48, breakdown);
    const c = composeChart(song, { targetStars: 5 });
    const spins = c.notes.filter((n) => n[3] === 'spin');
    expect(spins.length).toBe(2);
    for (const sp of spins) {
      const [t, lane, dur] = sp as [number, number, number, string];
      expect(lane).toBe(0);
      expect(dur).toBeGreaterThanOrEqual(2); // ≥ a bar at 120 BPM
      const others = c.notes.filter((n) => n !== sp);
      // A beat of empty field before the wheel, nothing during it, and after it the notes' whole
      // fall (3.5 beats) so nothing is on its way while the wheel is still up.
      for (const n of others) {
        const end = n[0] + ((n[2] as number | undefined) ?? 0);
        expect(end <= t - 0.5 + 1e-6 || n[0] >= t + dur + 1.75 - 1e-6, `note at ${n[0]} vs spinner ${t}–${t + dur}`).toBe(true);
      }
    }
    expect(thumbViolations(c.notes, c.sections!)).toEqual([]);
    expect(composeChart(song, { chapter: 'easy' }).notes.some((n) => n[3] === 'spin')).toBe(false);
    expect(composeChart(song, { chapter: 'medium' }).notes.filter((n) => n[3] === 'spin').length).toBe(1);
    // A quiet stretch whose energy does not really drop (a wash at 0.48 against a 0.75 median), and a song
    // without a breakdown, get no spinner.
    const shallow = fakeAnalysis(48, (bar, step) => ((bar >= 8 && bar < 11) || (bar >= 40 && bar < 43) ? { strength: 0.48 } : breakdown(bar, step)));
    expect(composeChart(shallow, { targetStars: 5 }).notes.some((n) => n[3] === 'spin')).toBe(false);
    expect(
      composeChart(
        fakeAnalysis(48, (_bar, step) => drumLoop(8, step)),
        { targetStars: 5 },
      ).notes.some((n) => n[3] === 'spin'),
    ).toBe(false);
  });

  it('is deterministic for the same seed', () => {
    expect(composeChart(analysis, { seed: 7 })).toEqual(composeChart(analysis, { seed: 7 }));
  });
});

describe('figureOf', () => {
  const quiet = new Array<number>(16).fill(0.05);

  it('picks the local peaks above 40 % of the max, loudest first, at most K steps a gap apart', () => {
    const profile = [...quiet];
    profile[0] = 0.9;
    profile[4] = 0.5;
    profile[6] = 0.3; // below the relative threshold
    profile[10] = 0.7;
    expect(figureOf(profile, 8, 2, null).steps).toEqual([0, 10, 4]);
    expect(figureOf(profile, 2, 2, null).steps).toEqual([0, 10]);
    expect(figureOf(profile, 8, 2, null).signature).toBe('0,4,10');
    // With a beat gap the eighth-neighbour of a chosen step is skipped.
    profile[2] = 0.8;
    expect(figureOf(profile, 8, 4, null).steps).toEqual([0, 10, 4]);
    expect(figureOf(new Array<number>(16).fill(0.02), 8, 2, null).steps).toEqual([]);
  });

  it('never keeps a sixteenth pair, keeps the beat next to a louder off-grid stab, and always keeps a loud beat', () => {
    const stab = [...quiet];
    stab[7] = 0.75;
    stab[8] = 1;
    expect(figureOf(stab, 8, 2, null).steps).toEqual([8]);
    const before = [...quiet];
    before[15] = 0.9; // the stab
    before[0] = 0.85; // the kick
    before[8] = 0.6;
    expect(figureOf(before, 8, 2, null).steps).toEqual([0, 8]);
    // Four loud kicks always make the figure, even when a bass line has louder peaks elsewhere.
    const kicks = [...quiet];
    for (const k of [0, 4, 8, 12]) kicks[k] = 0.85;
    for (const k of [2, 6, 10]) kicks[k] = 0.95;
    expect([...figureOf(kicks, 4, 2, null).steps].sort((a, b) => a - b)).toEqual([0, 4, 8, 12]);
  });

  it('adds one isolated pickup pair when the tempo allows it', () => {
    const profile = [...quiet];
    profile[0] = 1;
    profile[8] = 0.9;
    profile[6] = 0.7; // "ta" before the "KA" on beat 3
    // ★3 at 120 BPM: an eighth is 0.25 s ≥ the 0.23 s pair gap.
    expect(figureOf(profile, 4, 4, { minSec: 0.23, slotSec: 0.125 }).signature).toBe('0,6,8');
    // Too fast for the pair (an eighth of 0.1 s), or no pairs at this ★: beats only.
    expect(figureOf(profile, 4, 4, { minSec: 0.23, slotSec: 0.1 }).signature).toBe('0,8');
    expect(figureOf(profile, 4, 4, null).signature).toBe('0,8');
    // Not isolated: a step a beat from the pickup on the other side.
    profile[2] = 0.8;
    expect(figureOf(profile, 4, 4, { minSec: 0.23, slotSec: 0.125 }).signature).toBe('0,2,8');
  });

  it('keeps the previous figure while it still sounds and nothing new stands out', () => {
    const a = [...quiet];
    a[0] = 1;
    a[6] = 0.6;
    a[8] = 0.9;
    const prev = figureOf(a, 4, 2, null);
    const b = [...quiet];
    b[0] = 1;
    b[6] = 0.5;
    b[8] = 0.8;
    b[10] = 0.55; // a new step, but not loud enough to break the figure
    expect(figureOf(b, 4, 2, null, prev).signature).toBe(prev.signature);
    const c = [...b];
    c[6] = 0.3; // a kept step went quiet
    expect(figureOf(c, 4, 2, null, prev).signature).toBe('0,8,10');
    const d = [...b];
    d[10] = 0.95; // something new stands out
    expect(figureOf(d, 4, 2, null, prev).signature).not.toBe(prev.signature);
    expect(figureOf(b, 2, 2, null, prev).signature).toBe('0,8'); // the budget shrank below the old figure
  });

  it('shrinks by its weakest, most off-beat step, keeping loud beats for last', () => {
    const f = figureOf([1, 0.05, 0.6, 0.05, 0.85, 0.05, 0.5, 0.05, 0.9, 0.05, 0.05, 0.05, 0.85, 0.05, 0.05, 0.05], 8, 2, null);
    expect(f.signature).toBe('0,2,4,6,8,12');
    const s1 = shrinkFigure(f);
    expect(s1.signature).toBe('0,2,4,8,12');
    expect(s1.budget).toBe(7);
    expect(shrinkFigure(s1).signature).toBe('0,4,8,12');
    expect(shrinkFigure(shrinkFigure(s1)).signature).toBe('0,4,8'); // a loud beat goes only when nothing else is left
  });
});

describe('circleSpread', () => {
  it('cycles 8 positions across the field without two equal in a row', () => {
    for (let n = 2; n <= 6; n++) {
      const spread = circleSpread(n);
      expect(spread.length).toBe(8);
      for (const l of spread) expect(l >= 0 && l < n).toBe(true);
      for (let i = 0; i < spread.length; i++) expect(spread[i]).not.toBe(spread[(i + 1) % spread.length]);
      expect(spread).toContain(0);
      expect(spread).toContain(n - 1);
    }
  });
});

describe('rateStars', () => {
  const taps = (nps: number, seconds: number): NoteTuple[] =>
    Array.from({ length: Math.round(nps * seconds) }, (_, i) => [Math.round((i / nps) * 1000) / 1000, i % 4]);

  it('rates sparse taps ★1–2, four to the bar at 140 BPM ★3–4 and a sixteenth stream as fitting nothing', () => {
    expect(rateStars(taps(1, 120), 100)).toBeLessThanOrEqual(2);
    expect(rateStars(taps(1, 120), 100)).toBeGreaterThanOrEqual(1);
    const four = taps(140 / 60, 60);
    expect(rateStars(four, 140)).toBeGreaterThanOrEqual(3);
    expect(rateStars(four, 140)).toBeLessThanOrEqual(4);
    const stream: NoteTuple[] = [];
    for (let i = 0; i < 600; i++) {
      const t = Math.round(i * 0.15 * 1000) / 1000;
      stream.push(i % 5 === 0 ? [t, i % 6, 0, 'circle'] : [t, i % 6]);
    }
    expect(rateStars(stream, 200, [[0, 6]])).toBe(MAX_STARS + 1);
  });

  it('grows with density, width and chords, never above the ceiling', () => {
    const base = taps(2, 120);
    expect(rateStars(taps(3, 120))).toBeGreaterThanOrEqual(rateStars(base));
    expect(rateStars(base, 120, [[0, 5]])).toBeGreaterThanOrEqual(rateStars(base, 120, [[0, 3]]));
    const withChords = base.flatMap((n, i): NoteTuple[] => (i % 8 === 0 ? [n, [n[0], (n[1] + 2) % 4]] : [n]));
    expect(rateStars(withChords, 120, [[0, 4]], barTimesOf(60))).toBeGreaterThanOrEqual(rateStars(base, 120, [[0, 4]], barTimesOf(60)));
    expect(rateStars(taps(6, 120), 120)).toBeLessThanOrEqual(MAX_STARS + 1);
  });
});
