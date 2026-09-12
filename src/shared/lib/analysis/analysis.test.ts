import { describe, expect, it } from 'vitest';
import { RealFFT } from './fft';
import { detectOnsets } from './OnsetDetector';
import { estimateBpm } from './BpmEstimator';
import { estimateDownbeatPhase, trackBeats } from './BeatTracker';
import { analyzeSong, STEPS_PER_BAR, type Slot, type SongAnalysis } from './SongAnalyzer';
import { composeChart } from './ChartGenerator';
import { patternSteps } from './phrasePattern';
import { circleSpread } from './laneAssign';
import { chartFeatures, rateStars } from './stars';
import { synthesizeClicks } from './synthetic';
import { DENSITY_LIMIT } from '@/shared/config/constants';
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
function fakeAnalysis(bars: number, pattern: (bar: number, step: number) => Partial<Slot>): SongAnalysis {
  const slots: Slot[] = [];
  const beats: number[] = [];
  const step = 0.125; // 120 BPM sixteenth
  for (let b = 0; b < bars; b++) {
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      if (s % 4 === 0) beats.push((b * STEPS_PER_BAR + s) * step);
      slots.push({
        time: (b * STEPS_PER_BAR + s) * step,
        bar: b,
        step: s,
        strength: 0,
        low: 0.3,
        mid: 0.5,
        high: 0.2,
        sustain: 0,
        ...pattern(b, s),
      });
    }
  }
  beats.push(bars * STEPS_PER_BAR * step);
  return {
    bpm: 120,
    confidence: 1,
    beats,
    slots,
    barCount: bars,
    duration: bars * 2,
    onsetCount: 0,
    beatConfidence: 1,
  };
}

const isHoldType = (n: NoteTuple) => n.length >= 3 && (n[2] as number) > 0;

/** Max simultaneous fingers a chart needs at any instant (notes starting + hold-types still active). */
function maxFingers(notes: readonly NoteTuple[]): number {
  let worst = 0;
  const starts = [...new Set(notes.map((n) => n[0]))];
  for (const t of starts) {
    const starting = notes.filter((n) => n[0] === t).length;
    const holding = notes.filter((n) => isHoldType(n) && n[0] < t && n[0] + (n[2] as number) > t + 1e-6).length;
    worst = Math.max(worst, starting + holding);
  }
  return worst;
}

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

const sustainedLoop = (bar: number, step: number): Partial<Slot> => ({
  ...drumLoop(bar, step),
  sustain: step % 4 === 0 ? 6 : 0,
  low: 0.2,
  mid: 0.7,
  high: 0.1,
});

describe('composeChart', () => {
  const analysis = fakeAnalysis(48, drumLoop);
  const chart = composeChart(analysis);
  const slotTimes = new Set(analysis.slots.map((s) => s.time));

  it('puts every note exactly on a grid slot and never needs more than two fingers', () => {
    expect(chart.notes.length).toBeGreaterThan(0);
    for (const n of chart.notes) expect(slotTimes.has(n[0])).toBe(true);
    expect(maxFingers(chart.notes)).toBeLessThanOrEqual(2);
    expect(maxFingers(composeChart(fakeAnalysis(24, sustainedLoop)).notes)).toBeLessThanOrEqual(2);
  });

  it('respects the density limit, lane rules and chord validity', () => {
    const { notes, sections } = chart;
    const lanesAt = (t: number) => sections!.filter((s) => s[0] <= t + 1e-9).pop()![1];
    const starts = [...new Set(notes.map((n) => n[0]))];
    for (const t of starts) expect(starts.filter((s) => s >= t && s < t + 1).length).toBeLessThanOrEqual(DENSITY_LIMIT);
    const events = starts.map((t) => notes.filter((n) => n[0] === t).map((n) => n[1]));
    for (let i = 2; i < events.length; i++) for (const lane of events[i]) expect(events[i - 1].includes(lane) && events[i - 2].includes(lane)).toBe(false);
    for (const t of starts) {
      const lanes = notes.filter((n) => n[0] === t).map((n) => n[1]);
      expect(new Set(lanes).size).toBe(lanes.length);
      expect(lanes.length).toBeLessThanOrEqual(2);
      for (const l of lanes) expect(l >= 0 && l < lanesAt(t)).toBe(true);
    }
  });

  it('changes the lane count per phrase and keeps every note inside its section', () => {
    const sections = chart.sections!;
    expect(sections[0]).toEqual([0, 4]);
    expect(new Set(sections.map((s) => s[1])).size).toBeGreaterThan(1);
    const lanesAt = (t: number) => sections.filter((s) => s[0] <= t + 1e-9).pop()![1];
    for (const n of chart.notes) expect(n[1]).toBeLessThan(lanesAt(n[0]));
    expect(composeChart(analysis, { laneVariation: false }).sections).toEqual([[0, 4]]);
  });

  it('leaves two beats of silence before every lane-count change', () => {
    const sections = chart.sections!;
    for (let i = 1; i < sections.length; i++) {
      const t = sections[i][0];
      const before = chart.notes.filter((n) => n[0] < t && n[0] + (n.length >= 3 ? (n[2] as number) : 0) > t - 1 + 1e-6);
      expect(before).toEqual([]);
    }
  });

  it('opens intense phrases with circle-only windows that follow the pattern', () => {
    const circles = chart.notes.filter((n) => n[3] === 'circle');
    expect(circles.length).toBeGreaterThan(0);
    // bars 8–11 are the first intense phrase → a window there with no lane notes (nor one beat before).
    const win = chart.notes.filter((n) => n[0] >= 16 && n[0] < 24);
    expect(win.length).toBeGreaterThan(0);
    expect(win.every((n) => n[3] === 'circle')).toBe(true);
    expect(chart.notes.filter((n) => n[0] >= 15.5 && n[0] < 16)).toEqual([]);
    // Circles keep coming while the rhythm keeps going: a 4-bar window of eighths gives ≥ 12 of them.
    expect(win.length).toBeGreaterThanOrEqual(12);
    for (let i = 1; i < win.length; i++) {
      expect(win[i][0] - win[i - 1][0]).toBeGreaterThanOrEqual(0.25 - 1e-6);
      expect(win[i][1]).not.toBe(win[i - 1][1]);
    }
    expect(new Set(win.map((n) => n[1])).size).toBeGreaterThan(2);
  });

  it('reproduces the phrase figure note-for-note in every bar and makes accents chords', () => {
    // "ту ту ТУ ту ту ТУ": eighths on 0 2 4 6 8 10 with the loud ones on 4 and 10, identical in every bar.
    const figure: Record<number, number> = {
      0: 0.6,
      2: 0.6,
      4: 1,
      6: 0.6,
      8: 0.6,
      10: 1,
    };
    const { notes } = composeChart(
      fakeAnalysis(16, (_bar, step) => ({ strength: figure[step] ?? 0 })),
      { laneVariation: false },
    );
    const stepOf = (t: number) => Math.round(t / 0.125) % STEPS_PER_BAR;
    const barOf = (t: number) => Math.floor(Math.round(t / 0.125) / STEPS_PER_BAR);
    for (let b = 0; b < 16; b++) {
      const own = notes.filter((n) => barOf(n[0]) === b);
      expect([...new Set(own.map((n) => stepOf(n[0])))].sort((x, y) => x - y)).toEqual([0, 2, 4, 6, 8, 10]);
      for (const step of [4, 10]) expect(own.filter((n) => stepOf(n[0]) === step).length).toBe(2);
      for (const step of [0, 2, 6, 8]) expect(own.filter((n) => stepOf(n[0]) === step).length).toBe(1);
    }
    expect(maxFingers(notes)).toBeLessThanOrEqual(2);
  });

  it('allows sixteenth pairs in intense bars when the pattern has them, an eighth apart otherwise', () => {
    // "ta-ka" before beat 3 in every bar of an intense song: 0 4 7 8 12.
    const figure: Record<number, number> = {
      0: 1,
      4: 0.9,
      7: 0.85,
      8: 1,
      12: 0.9,
      14: 0.7,
    };
    const { notes } = composeChart(
      fakeAnalysis(16, (_bar, step) => ({ strength: figure[step] ?? 0 })),
      { laneVariation: false },
    );
    const stepOf = (t: number) => Math.round(t / 0.125) % STEPS_PER_BAR;
    const early = notes.filter((n) => n[0] < 8); // bars 0–3: no circle window yet
    expect([...new Set(early.map((n) => stepOf(n[0])))].sort((x, y) => x - y)).toEqual([0, 4, 7, 8, 12, 14]);
    expect(maxFingers(notes)).toBeLessThanOrEqual(2);
    // Quiet figures never get sixteenth gaps.
    const soft: Record<number, number> = {
      0: 0.2,
      4: 0.18,
      7: 0.16,
      8: 0.2,
      12: 0.18,
    };
    const sparse = composeChart(
      fakeAnalysis(16, (_bar, step) => ({ strength: soft[step] ?? 0 })),
      { laneVariation: false },
    ).notes;
    const times = [...new Set(sparse.map((n) => n[0]))].sort((a, b) => a - b);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(0.25 - 1e-6);
  });

  it('keeps quiet phrases sparse and lets intense phrases of energetic songs reach the density limit', () => {
    const starts = [...new Set(chart.notes.map((n) => n[0]))].sort((a, b) => a - b);
    const intro = starts.filter((t) => t < 16);
    for (const t of intro) expect(intro.filter((s) => s >= t && s < t + 1).length).toBeLessThanOrEqual(3);
    const perBar = new Map<number, number>();
    for (const t of starts) perBar.set(Math.floor(t / 2), (perBar.get(Math.floor(t / 2)) ?? 0) + 1);
    // drumLoop: bars 8–23 and 32–47 are intense (≤ 9 per bar), the rest quiet or medium (≤ 6).
    for (const [bar, count] of perBar) expect(count).toBeLessThanOrEqual(bar < 8 || (bar >= 24 && bar < 32) ? 6 : 9);
  });

  it('draws lane counts from the intensity pools (2–6, intro on 4)', () => {
    const counts = chart.sections!.map((s) => s[1]);
    expect(counts[0]).toBe(4);
    for (const c of counts) expect(c >= 2 && c <= 6).toBe(true);
    expect(Math.min(...counts)).toBeLessThanOrEqual(3);
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(5);
    // Energetic songs decide every 4 bars (8 s at 120 BPM), calm ones every 8.
    for (const s of chart.sections!) expect(s[0] % 8).toBeCloseTo(0, 6);
  });

  it('turns drum fills into rolls', () => {
    const rolls = composeChart(fakeAnalysis(16, fillLoop)).notes.filter((n) => n[3] === 'roll');
    expect(rolls.length).toBeGreaterThan(0);
    for (const r of rolls) {
      expect(r[2]).toBeGreaterThan(0);
      expect(r[4]).toBeGreaterThanOrEqual(3);
    }
  });

  it('makes some long holds into slides that end in a free neighbouring lane', () => {
    const notes = composeChart(fakeAnalysis(32, sustainedLoop)).notes;
    const slides = notes.filter((n) => n[3] === 'slide');
    expect(slides.length).toBeGreaterThan(0);
    for (const s of slides) {
      const end = s[4] as number;
      expect(end).not.toBe(s[1]);
      expect(Math.abs(end - s[1])).toBeLessThanOrEqual(2);
      const during = notes.filter((n) => n !== s && n[1] === end && n[0] > s[0] && n[0] < s[0] + (s[2] as number) - 1e-6);
      expect(during).toEqual([]);
    }
    expect(chartFeatures({ stars: 1, notes }).slides).toBe(slides.length);
  });

  it('never starts a note in a lane that is still being held', () => {
    const notes = composeChart(fakeAnalysis(24, sustainedLoop)).notes;
    const holds = notes.filter(isHoldType);
    expect(holds.length).toBeGreaterThan(0);
    for (const h of holds) {
      const end = h[0] + (h[2] as number);
      const clash = notes.some((n) => n !== h && n[1] === h[1] && n[0] > h[0] && n[0] < end - 1e-6);
      expect(clash).toBe(false);
    }
  });

  it('gets denser with intensity', () => {
    const quiet = chart.notes.filter((n) => n[0] < 16).length;
    const intense = chart.notes.filter((n) => n[0] >= 20 && n[0] < 36).length;
    expect(intense).toBeGreaterThan(quiet);
  });

  it('gives quiet intros sparse notes but leaves true silence empty', () => {
    const silentIntro = fakeAnalysis(24, (bar, step) => {
      if (bar < 4) return { strength: 0 };
      if (bar < 8) return { strength: step % 4 === 0 ? 0.08 : 0.02 };
      return drumLoop(bar, step);
    });
    const { notes } = composeChart(silentIntro);
    expect(notes.filter((n) => n[0] < 8).length).toBe(0);
    expect(notes.filter((n) => n[0] >= 8 && n[0] < 16).length).toBeGreaterThan(0);
  });

  it('places alternating slow / heart spell notes as plain taps', () => {
    const spells = chart.notes.filter((n) => n[3] === 'slow' || n[3] === 'heart');
    expect(spells.length).toBeGreaterThanOrEqual(2);
    expect(spells[0][3]).toBe('slow');
    expect(spells[1][3]).toBe('heart');
    for (const s of spells) expect(s[2]).toBe(0);
  });

  it('is deterministic for the same seed', () => {
    expect(composeChart(analysis, { seed: 7 })).toEqual(composeChart(analysis, { seed: 7 }));
  });
});

describe('patternSteps', () => {
  it('picks the local peaks above 40 % of the max, loudest first', () => {
    const profile = new Array<number>(16).fill(0.05);
    profile[0] = 0.9;
    profile[4] = 0.5;
    profile[6] = 0.3; // below the relative threshold
    profile[10] = 0.7;
    expect(patternSteps(profile, false, 8)).toEqual([0, 10, 4]);
    expect(patternSteps(profile, false, 2)).toEqual([0, 10]);
    expect(patternSteps(new Array<number>(16).fill(0.02), false, 8)).toEqual([]);
  });

  it('keeps sixteenth pairs only in intense phrases', () => {
    const profile = new Array<number>(16).fill(0);
    profile[7] = 0.75;
    profile[8] = 1;
    expect(patternSteps(profile, true, 8)).toEqual([8, 7]);
    expect(patternSteps(profile, false, 8)).toEqual([8]);
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

  it('spreads felt difficulty from ★2 for sparse taps to ★8+ for dense sixteenth streams', () => {
    expect(rateStars(taps(1, 120), 100)).toBeLessThanOrEqual(3);
    expect(rateStars(taps(1, 120), 100)).toBeGreaterThanOrEqual(1);
    const stream: NoteTuple[] = [];
    for (let i = 0; i < 600; i++) {
      const t = Math.round(i * 0.15 * 1000) / 1000;
      stream.push(i % 5 === 0 ? [t, i % 6, 0, 'circle'] : [t, i % 6]);
    }
    expect(rateStars(stream, 200, [[0, 6]])).toBeGreaterThanOrEqual(8);
  });

  it('grows with density, width, mechanics and tempo', () => {
    const base = taps(2, 120);
    expect(rateStars(taps(3, 120))).toBeGreaterThanOrEqual(rateStars(base));
    expect(rateStars(base, 180)).toBeGreaterThanOrEqual(rateStars(base, 100));
    expect(rateStars(base, 120, [[0, 6]])).toBeGreaterThanOrEqual(rateStars(base, 120, [[0, 3]]));
    const withRolls = base.map((n, i): NoteTuple => (i % 4 === 0 ? [n[0], n[1], 0.4, 'roll', 3] : n));
    expect(rateStars(withRolls)).toBeGreaterThanOrEqual(rateStars(base));
  });
});
