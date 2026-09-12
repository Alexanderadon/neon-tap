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
function fakeLayers(
  bars: number,
  rule: (layer: Layer, bar: number, step: number) => number,
  energyOf?: (layer: Layer, bar: number, step: number) => number,
): StemLayers {
  const n = bars * STEPS_PER_BAR;
  const onset = {} as LayerStrengths;
  const energy = {} as LayerStrengths;
  for (const l of ['vocals', 'drums', 'bass', 'other'] as const) {
    onset[l] = new Float32Array(n);
    for (let i = 0; i < n; i++) onset[l][i] = rule(l, Math.floor(i / STEPS_PER_BAR), i % STEPS_PER_BAR);
    const flat = Math.max(...onset[l]) * 0.3;
    energy[l] = new Float32Array(n);
    for (let i = 0; i < n; i++) energy[l][i] = energyOf ? energyOf(l, Math.floor(i / STEPS_PER_BAR), i % STEPS_PER_BAR) : flat;
  }
  return { onset, energy };
}

/** Notes grouped by bar → their steps, for reading a chart against the sounds that made it. */
function stepsByBar(analysis: SongAnalysis, notes: readonly NoteTuple[]): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const n of notes) {
    const slot = analysis.slots.find((s) => Math.abs(s.time - n[0]) < 1e-6);
    if (!slot) continue;
    const list = out.get(slot.bar) ?? [];
    if (!list.includes(slot.step)) list.push(slot.step);
    out.set(
      slot.bar,
      list.sort((a, b) => a - b),
    );
  }
  return out;
}

/** Any two tiles at the same moment (a chord)? */
const twoAtOnce = (notes: readonly NoteTuple[]): boolean => notes.some((n, i) => notes.findIndex((m) => m[0] === n[0]) !== i);
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

  it('judges by the clearest hits, not by busyness, and takes turns between close instruments', () => {
    const idx = Array.from({ length: 64 }, (_, i) => i);
    // A hi-hat on every eighth at 0.7 against a melody with two clean hits per bar at 1.0: the melody leads.
    const busyHats = fakeLayers(
      4,
      (l, _b, step) => (l === 'drums' ? (step % 2 === 0 ? 0.7 : 0) : l === 'other' ? (step % 8 === 0 ? 1 : 0) : 0),
      (l) => (l === 'drums' || l === 'other' ? 1 : 0.01),
    );
    expect(pickLayer(busyHats, idx)).toBe('other');
    // Voice and bass equally clear: the voice wins fresh and keeps the next phrase; after two phrases the bass gets its turn.
    const duet = fakeLayers(
      4,
      (l, _b, step) => (l === 'vocals' || l === 'bass' ? (step % 4 === 0 ? 1 : 0) : 0),
      (l) => (l === 'vocals' || l === 'bass' ? 1 : 0.01),
    );
    expect(pickLayer(duet, idx)).toBe('vocals');
    expect(pickLayer(duet, idx, 'vocals', 1)).toBe('vocals');
    expect(pickLayer(duet, idx, 'vocals', 2)).toBe('bass');
    expect(pickLayer(duet, idx, 'bass', 2)).toBe('vocals');
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

  it("keeps the tiles on the song's own audible hits: stems never move a tile", () => {
    // The mix hits on every eighth; a singer on 0 and 6 changes nothing about where tiles are.
    const steps = withVoice.notes.filter((n) => !n[3] || n[3] === 'slide').map((n) => stepOf(analysis, n[0]));
    expect(steps.every((s) => s !== undefined && s % 2 === 0)).toBe(true);
    expect(plain.notes.some((n) => stepOf(analysis, n[0]) === 4)).toBe(true);
    expect(withVoice.notes.length).toBeGreaterThan(bars);
  });

  it('reports the layer of every phrase', () => {
    let seen: (Layer | null)[] = [];
    composeChart(analysis, { layers: vocal, onLayers: (l) => (seen = l) });
    expect(seen).toEqual(['vocals', 'vocals', 'vocals', 'vocals']);
  });

  it('makes holds only from a ringing melodic instrument: drums alone never hold', () => {
    // A hit on beats 1 and 3 only, so a ringing sound has room; the mix says "sustain" everywhere.
    const roomy = fakeAnalysis(bars, (_b, s) => ({ strength: s % 8 === 0 ? 1 : 0, sustain: 6, low: 0.2, mid: 0.7 }));
    const drums = fakeLayers(
      bars,
      (l, _b, step) => (l === 'drums' ? (step % 8 === 0 ? 1 : 0.2) : 0),
      (l) => (l === 'drums' ? 1 : 0.005),
    );
    const isLong = (n: NoteTuple) => n.length >= 3 && (n[2] as number) > 0 && n[3] !== 'roll' && n[3] !== 'spin';
    expect(composeChart(roomy, { layers: drums }).notes.filter(isLong)).toEqual([]);
    const melodic = fakeLayers(
      bars,
      (l, _b, step) => (l === 'other' ? (step % 8 === 0 ? 1 : 0) : 0.02),
      (l) => (l === 'other' ? 1 : 0.005),
    );
    expect(composeChart(roomy, { layers: melodic }).notes.filter(isLong).length).toBeGreaterThan(0);
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

  it('reads every bar on its own: a tile for each audible hit of the song, none where it is silent', () => {
    // The song hits a different figure in every bar — no 4-bar average could reproduce it.
    const figure = (bar: number): number[] =>
      [
        [0, 6, 10],
        [2, 8],
        [0, 4, 8, 12],
        [3, 9, 14],
      ][bar % 4];
    const song = fakeAnalysis(bars, (bar, step) => ({ strength: figure(bar).includes(step) ? 1 : 0.02 }));
    const c = composeChart(song, { laneVariation: false });
    const lane = (notes: readonly NoteTuple[]) => notes.filter((n) => !n[3] || n[3] === 'slide' || n[3] === 'circle');
    const byBar = stepsByBar(song, lane(c.notes));
    let matched = 0;
    for (let b = 0; b < bars; b++) {
      const got = byBar.get(b) ?? [];
      // Circle windows and the lane-change gap may drop a hit; nothing may be invented.
      for (const s of got) expect(figure(b), `bar ${b} step ${s}`).toContain(s);
      if (got.length === figure(b).length) matched++;
    }
    expect(matched).toBeGreaterThanOrEqual(bars * 0.5);
    // With stems, every note is a tile too: a singer on 5 and 13 adds those hits, and nothing else moves.
    const sung = fakeLayers(
      bars,
      (l, _b, step) => (l === 'vocals' ? (step === 5 || step === 13 ? 1 : 0) : 0.05),
      (l) => (l === 'vocals' ? 1 : 0.02),
    );
    const withSinger = lane(composeChart(song, { laneVariation: false, layers: sung }).notes);
    let sungTiles = 0;
    for (const n of withSinger) {
      const slot = song.slots.find((s) => Math.abs(s.time - n[0]) < 1e-6)!;
      if (slot.step === 5 || slot.step === 13) sungTiles++;
      else expect(figure(slot.bar), `bar ${slot.bar} step ${slot.step}`).toContain(slot.step);
    }
    expect(sungTiles).toBeGreaterThan(bars);
  });

  it('holds only where an instrument rings for a beat or more, and never across another audible hit', () => {
    // Hits on beats 1 and 3; in even bars the lead rings from beat 1 for six slots, in odd bars it is a short stab.
    const song = fakeAnalysis(bars, (_b, s) => ({ strength: s % 8 === 0 ? 1 : 0.02, sustain: 0 }));
    const ringing = (bar: number, step: number) => bar % 2 === 0 && step <= 6;
    const lead = fakeLayers(
      bars,
      (l, _b, step) => (l === 'other' ? (step === 0 || step === 8 ? 1 : 0) : 0.05),
      (l, bar, step) => (l === 'other' ? (ringing(bar, step) || step === 8 ? 1 : 0.05) : 0.02),
    );
    const c = composeChart(song, { layers: lead, laneVariation: false });
    const holds = c.notes.filter((n) => n.length >= 3 && (n[2] as number) > 0 && n[3] !== 'spin' && n[3] !== 'roll');
    expect(holds.length).toBeGreaterThanOrEqual(bars / 4);
    for (const h of holds) {
      const slot = song.slots.find((s) => Math.abs(s.time - h[0]) < 1e-6)!;
      expect(slot.step).toBe(0);
      expect(slot.bar % 2).toBe(0);
      expect(h[2]).toBeGreaterThanOrEqual(0.5);
      expect(h[2]).toBeLessThanOrEqual(0.75 + 1e-6);
    }
    // The same ringing lead over a kick on every beat: "tu-DUN-dun-dun" — the kicks are taps, the hold stops at the next kick.
    const kicks = fakeAnalysis(bars, (_b, s) => ({ strength: s % 4 === 0 ? 1 : 0.02, sustain: 0 }));
    const c2 = composeChart(kicks, { layers: lead, laneVariation: false });
    for (const n of c2.notes) if (n.length >= 3 && (n[2] as number) > 0 && n[3] !== 'spin') expect(n[2]).toBeLessThanOrEqual(0.5 + 1e-6);
    const beats = c2.notes.filter((n) => !n[3]).map((n) => stepOf(kicks, n[0]));
    expect(beats.filter((s) => s === 4 || s === 12).length).toBeGreaterThan(bars);
  });

  it('makes a chord where two instruments hit together on the accent', () => {
    const together = fakeLayers(
      bars,
      (l, _b, step) => (l === 'vocals' ? (step === 0 ? 1 : step === 4 || step === 8 || step === 12 ? 0.5 : 0) : l === 'drums' ? (step === 0 ? 1 : 0) : 0),
      (l) => (l === 'vocals' || l === 'drums' ? 1 : 0.02),
    );
    const c = composeChart(analysis, { layers: together });
    const times = c.notes.map((n) => n[0]);
    const chords = times.filter((x, i) => times.indexOf(x) !== i);
    expect(chords.length).toBeGreaterThan(0);
    for (const x of chords) expect(analysis.slots.find((s) => Math.abs(s.time - x) < 1e-6)!.step).toBe(0);
    expect(twoAtOnce(c.notes)).toBe(true);
    // The same singer alone (no second instrument) gets no chords.
    const alone = fakeLayers(bars, (l, _b, step) => (l === 'vocals' ? (step === 0 ? 1 : step % 4 === 0 ? 0.5 : 0) : 0.05));
    const t2 = composeChart(analysis, { layers: alone }).notes.map((n) => n[0]);
    expect(t2.filter((x, i) => t2.indexOf(x) !== i)).toEqual([]);
  });

  it('changes the lane count only where the music changes', () => {
    const long = 64;
    const steady = fakeAnalysis(long, drumMix);
    const oneVoice = fakeLayers(long, (l, _b, step) => (l === 'vocals' ? (step % 4 === 0 ? 1 : 0) : 0.05));
    const c1 = composeChart(steady, { layers: oneVoice });
    // Nothing changes in the music: only the every-16-bars fallback may switch lanes.
    for (const [time] of c1.sections!.slice(1)) expect(Math.round(time / 2) % 16).toBe(0);
    // The drums take over at bar 12 (phrase 3): the lane count changes right there.
    const handOver = fakeLayers(long, (l, bar, step) =>
      bar >= 12 && bar < 28 ? (l === 'drums' ? (step % 2 === 0 ? 1 : 0) : 0.05) : l === 'vocals' ? (step % 4 === 0 ? 1 : 0) : 0.05,
    );
    const c2 = composeChart(steady, { layers: handOver, seed: 3 });
    expect(c2.sections!.some(([time]) => Math.abs(time - 24) < 1e-6)).toBe(true);
    // Every other boundary is a music change (bars 12, 28) or the fallback 16 bars after the previous one.
    const barsAt = c2.sections!.map(([time]) => Math.round(time / 2));
    for (let i = 1; i < barsAt.length; i++) expect([12, 28].includes(barsAt[i]) || barsAt[i] === barsAt[i - 1] + 16, `boundary at bar ${barsAt[i]}`).toBe(true);
  });

  it('is deterministic and still on the grid', () => {
    const again = composeChart(analysis, { layers: vocal });
    expect(again.notes).toEqual(withVoice.notes);
    const times = new Set(analysis.slots.map((s) => s.time));
    for (const n of withVoice.notes) expect(times.has(n[0])).toBe(true);
  });
});
