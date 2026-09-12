import { describe, expect, it } from 'vitest';
import { analyzeSong, STEPS_PER_BAR, type Slot, type SongAnalysis } from './SongAnalyzer';
import { fakeAnalysis, maxFingers, thumbViolations } from './playability';
import { composeChart } from './ChartGenerator';
import { layerEnergy, layerStrengths, pickLayer, type Layer, type LayerStrengths, type StemLayers } from './layers';
import { synthesizeClicks } from './synthetic';
import type { NoteTuple } from '@/shared/types/chart';

const SR = 22050;
const BEAT = 60 / 128;

/** A busy drum loop in the mix: every eighth is loud. */
const drumMix = (_bar: number, step: number): Partial<Slot> =>
  step % 2 === 0 ? { strength: step % 4 === 0 ? 1 : 0.8, low: 0.6, mid: 0.3, high: 0.4 } : { strength: 0.3, low: 0.1, mid: 0.3, high: 0.6 };

/** Stem layers from a per-slot onset rule; a layer's energy is its onset level, so silent rules mean an absent instrument. */
function fakeLayers(bars: number, rule: (layer: Layer, bar: number, step: number) => number, energyOf?: (layer: Layer) => number): StemLayers {
  const n = bars * STEPS_PER_BAR;
  const onset = {} as LayerStrengths;
  const energy = {} as LayerStrengths;
  for (const l of ['vocals', 'drums', 'bass', 'other'] as const) {
    onset[l] = new Float32Array(n);
    for (let i = 0; i < n; i++) onset[l][i] = rule(l, Math.floor(i / STEPS_PER_BAR), i % STEPS_PER_BAR);
    const e = energyOf ? energyOf(l) : Math.max(...onset[l]) * 0.3;
    energy[l] = new Float32Array(n).fill(e);
  }
  return { onset, energy };
}

const stepOf = (analysis: SongAnalysis, t: number) => analysis.slots.find((s) => Math.abs(s.time - t) < 1e-6)?.step;

describe('layerStrengths', () => {
  it('samples a stem on the mix grid: clicked slots are strong, silent slots are weak', () => {
    const mixTimes = Array.from({ length: 64 }, (_, i) => 0.5 + i * BEAT);
    const analysis = analyzeSong(synthesizeClicks(mixTimes, 32, SR, 1), SR);
    // The "stem" only sounds on every other beat.
    const stemTimes = mixTimes.filter((_, i) => i % 2 === 0);
    const v = layerStrengths(synthesizeClicks(stemTimes, 32, SR, 7), SR, analysis);
    expect(v.length).toBe(analysis.slots.length);
    const on: number[] = [];
    const off: number[] = [];
    analysis.slots.forEach((s, i) => {
      const near = (times: number[]) => times.some((t) => Math.abs(t - s.time) < 0.04);
      if (near(stemTimes)) on.push(v[i]);
      else if (!near(mixTimes)) off.push(v[i]);
    });
    expect(on.length).toBeGreaterThan(20);
    expect(on.filter((x) => x >= 0.5).length / on.length).toBeGreaterThan(0.9);
    expect(off.filter((x) => x < 0.2).length / off.length).toBeGreaterThan(0.95);
  });
});

describe('layerEnergy', () => {
  it('measures loudness per slot: clicks loud, silence zero', () => {
    const times = Array.from({ length: 64 }, (_, i) => 0.5 + i * BEAT);
    const analysis = analyzeSong(synthesizeClicks(times, 32, SR, 1), SR);
    const e = layerEnergy(synthesizeClicks(times, 32, SR, 1), SR, analysis);
    expect(e.length).toBe(analysis.slots.length);
    const onBeat = analysis.slots.map((s, i) => [s, e[i]] as const).filter(([s]) => times.some((t) => Math.abs(t - s.time) < 0.02));
    const offBeat = analysis.slots.map((s, i) => [s, e[i]] as const).filter(([s]) => !times.some((t) => Math.abs(t - s.time) < 0.1));
    expect(onBeat.length).toBeGreaterThan(40);
    expect(Math.min(...onBeat.map(([, v]) => v))).toBeGreaterThan(Math.max(...offBeat.map(([, v]) => v)));
    expect(layerEnergy(new Float32Array(SR * 32), SR, analysis).every((v) => v === 0)).toBe(true);
  });
});

describe('pickLayer', () => {
  it('follows the layer whose peaks carry the most weighted energy, the voice ahead of the hi-hat', () => {
    const idx = Array.from({ length: 64 }, (_, i) => i);
    const equal = fakeLayers(4, (_l, _b, step) => (step % 4 === 0 ? 1 : 0));
    expect(pickLayer(equal, idx)).toBe('vocals');
    const drums = fakeLayers(4, (l, _b, step) => (l === 'drums' ? (step % 2 === 0 ? 1 : 0) : step % 8 === 0 ? 0.6 : 0));
    expect(pickLayer(drums, idx)).toBe('drums');
    const bass = fakeLayers(4, (l, _b, step) => (l === 'bass' ? (step % 4 === 0 ? 1 : 0) : step % 8 === 0 ? 0.2 : 0));
    expect(pickLayer(bass, idx)).toBe('bass');
  });

  it('ignores a layer that is only separation bleed, however sharp its onsets look', () => {
    const idx = Array.from({ length: 64 }, (_, i) => i);
    const sharpBleed = fakeLayers(
      4,
      (l, _b, step) => (l === 'vocals' ? (step % 2 === 0 ? 1 : 0) : step % 4 === 0 ? 1 : 0),
      (l) => (l === 'vocals' ? 0.01 : l === 'drums' ? 1 : 0.5),
    );
    expect(pickLayer(sharpBleed, idx)).not.toBe('vocals');
    // A soft but present singer (15 % of the loudest stem) still wins.
    const softSinger = fakeLayers(
      4,
      (_l, _b, step) => (step % 4 === 0 ? 1 : 0),
      (l) => (l === 'vocals' ? 0.2 : 1),
    );
    expect(pickLayer(softSinger, idx)).toBe('vocals');
  });

  it('returns null when nothing audible plays', () => {
    const quiet = fakeLayers(4, () => 0.1);
    expect(
      pickLayer(
        quiet,
        Array.from({ length: 64 }, (_, i) => i),
      ),
    ).toBeNull();
  });
});

describe('composeChart with layers', () => {
  const bars = 16;
  const analysis = fakeAnalysis(bars, drumMix);
  // The singer phrases on steps 0 and 6 of every bar; drums are quiet in the stems.
  const vocal = fakeLayers(bars, (l, _b, step) => (l === 'vocals' ? (step === 0 || step === 6 ? 1 : 0) : l === 'drums' ? 0.15 : 0));
  const withVoice = composeChart(analysis, { layers: vocal });
  const plain = composeChart(analysis);

  it('puts notes on the followed instrument, not on the loud mix', () => {
    const steps = withVoice.notes.map((n) => stepOf(analysis, n[0]));
    expect(steps.every((s) => s === 0 || s === 6)).toBe(true);
    expect(plain.notes.some((n) => stepOf(analysis, n[0]) === 4)).toBe(true);
    expect(withVoice.notes.length).toBeGreaterThan(bars);
  });

  it('reports the layer of every phrase', () => {
    let seen: (Layer | null)[] = [];
    composeChart(analysis, { layers: vocal, onLayers: (l) => (seen = l) });
    expect(seen).toEqual(['vocals', 'vocals', 'vocals', 'vocals']);
  });

  it('gives drum phrases no long notes and melodic phrases no fills', () => {
    const sustained = fakeAnalysis(bars, (b, s) => ({ ...drumMix(b, s), sustain: s % 4 === 0 ? 6 : 0, low: 0.2, mid: 0.7 }));
    const drums = fakeLayers(bars, (l, _b, step) => (l === 'drums' ? (step % 2 === 0 ? 1 : 0.2) : 0));
    const drumChart = composeChart(sustained, { layers: drums });
    const isLong = (n: NoteTuple) => n.length >= 3 && (n[2] as number) > 0 && n[3] !== 'roll';
    expect(drumChart.notes.filter(isLong)).toEqual([]);
    const melodic = fakeLayers(bars, (l, _b, step) => (l === 'other' ? (step % 4 === 0 ? 1 : 0) : 0));
    const melodyChart = composeChart(sustained, { layers: melodic });
    expect(melodyChart.notes.filter((n) => n[3] === 'roll')).toEqual([]);
    expect(melodyChart.notes.filter(isLong).length).toBeGreaterThan(0);
  });

  it('stays playable with two thumbs whatever instrument it follows', () => {
    const sustained = fakeAnalysis(48, (b, s) => ({ ...drumMix(b, s), sustain: s % 4 === 0 ? 6 : 0, low: 0.2, mid: 0.7 }));
    const follow = (layer: Layer) => fakeLayers(48, (l, bar, step) => (l === layer ? (step % (bar % 8 < 4 ? 2 : 4) === 0 ? 1 : 0.1) : 0.05));
    for (const layer of ['vocals', 'drums', 'bass', 'other'] as const) {
      const c = composeChart(sustained, { layers: follow(layer) });
      expect(c.notes.length).toBeGreaterThan(48);
      expect(maxFingers(c.notes)).toBeLessThanOrEqual(2);
      expect(thumbViolations(c.notes, c.sections!)).toEqual([]);
    }
  });

  it('is deterministic and still on the grid', () => {
    const again = composeChart(analysis, { layers: vocal });
    expect(again.notes).toEqual(withVoice.notes);
    const times = new Set(analysis.slots.map((s) => s.time));
    for (const n of withVoice.notes) expect(times.has(n[0])).toBe(true);
  });
});
