import { describe, expect, it } from 'vitest';
import { RealFFT } from './fft';
import { detectOnsets } from './OnsetDetector';
import { estimateBpm } from './BpmEstimator';
import { capDensity, generateAllDifficulties, generateChart, quantize } from './ChartGenerator';
import { synthesizeClicks } from './synthetic';
import { DENSITY_LIMIT } from '@/shared/config/constants';

const SR = 22050;

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
    const bpm = 128;
    const beat = 60 / bpm;
    const truth: number[] = [];
    for (let i = 0; i < 60; i++) truth.push(1 + i * beat + (i % 3 === 0 ? beat / 2 : 0));
    const signal = synthesizeClicks(truth, 32, SR);
    const { onsets } = detectOnsets(signal, { sampleRate: SR });
    let hits = 0;
    for (const t of truth) if (onsets.some((o) => Math.abs(o.time - t) <= 0.03)) hits++;
    expect(hits / truth.length).toBeGreaterThanOrEqual(0.9);
    // No flood of false positives either.
    expect(onsets.length).toBeLessThan(truth.length * 1.5);
    for (const o of onsets) expect(o.strength).toBeGreaterThan(0);
  });
});

describe('estimateBpm', () => {
  it('recovers tempo of a 128 BPM click track within ±2 BPM', () => {
    const beat = 60 / 128;
    const truth = Array.from({ length: 64 }, (_, i) => 0.5 + i * beat);
    const signal = synthesizeClicks(truth, 32, SR);
    const { flux, hopSeconds } = detectOnsets(signal, { sampleRate: SR });
    const est = estimateBpm(flux, hopSeconds);
    expect(Math.abs(est.bpm - 128)).toBeLessThanOrEqual(2);
    expect(est.confidence).toBeGreaterThan(0.2);
  });
});

describe('ChartGenerator', () => {
  const bpm = 120;
  const beat = 60 / bpm;
  const onsets = Array.from({ length: 200 }, (_, i) => ({
    time: i * beat * 0.25 + 0.01 * ((i % 5) - 2), // jittered 16ths
    strength: 0.3 + ((i * 37) % 70) / 100,
    bands: [(i % 3) / 2, ((i + 1) % 3) / 2, ((i + 2) % 3) / 2] as [number, number, number],
  }));

  it('quantizes to the grid and merges duplicates', () => {
    const q = quantize(onsets, bpm, 0, 4);
    const step = beat / 4;
    for (const c of q) expect(Math.abs(c.time / step - Math.round(c.time / step))).toBeLessThan(1e-6);
    const slots = new Set(q.map((c) => Math.round(c.time / step)));
    expect(slots.size).toBe(q.length);
  });

  it('caps density at N notes per second', () => {
    const dense = Array.from({ length: 100 }, (_, i) => ({ time: i * 0.05, strength: 1, bands: [1, 0, 0] as [number, number, number] }));
    const capped = capDensity(dense, 6);
    for (let i = 0; i < capped.length; i++) {
      const windowCount = capped.filter((c) => c.time >= capped[i].time && c.time < capped[i].time + 1).length;
      expect(windowCount).toBeLessThanOrEqual(6);
    }
  });

  it('never puts more than 2 consecutive notes in one lane', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const { notes } = generateChart(onsets, { bpm, offset: 0, difficulty });
      for (let i = 2; i < notes.length; i++) {
        const same = notes[i][1] === notes[i - 1][1] && notes[i][1] === notes[i - 2][1];
        expect(same).toBe(false);
      }
    }
  });

  it('respects per-difficulty density limits and keeps notes sorted', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const { notes } = generateChart(onsets, { bpm, offset: 0, difficulty });
      expect(notes.length).toBeGreaterThan(0);
      for (let i = 1; i < notes.length; i++) expect(notes[i][0]).toBeGreaterThanOrEqual(notes[i - 1][0]);
      const starts = [...new Set(notes.map((n) => n[0]))];
      for (const t of starts) {
        const inWindow = starts.filter((s) => s >= t && s < t + 1).length;
        expect(inWindow).toBeLessThanOrEqual(DENSITY_LIMIT[difficulty]);
      }
    }
  });

  it('produces monotonic star ratings across difficulties', () => {
    const all = generateAllDifficulties(onsets, bpm, 0);
    expect(all.easy.stars).toBeLessThan(all.normal.stars);
    expect(all.normal.stars).toBeLessThan(all.hard.stars);
    expect(all.easy.notes.length).toBeLessThanOrEqual(all.hard.notes.length);
  });

  it('is deterministic for the same seed', () => {
    const a = generateChart(onsets, { bpm, offset: 0, difficulty: 'hard', seed: 7 });
    const b = generateChart(onsets, { bpm, offset: 0, difficulty: 'hard', seed: 7 });
    expect(a).toEqual(b);
  });
});
