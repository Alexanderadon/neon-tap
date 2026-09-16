import { describe, expect, it } from 'vitest';
import { analyzeSong, STEPS_PER_BAR, type Slot, type SongAnalysis } from './SongAnalyzer';
import { assertPlayable, fakeAnalysis, maxFingers, thumbViolations } from './playability';
import { composeChart, type ComposeTrace } from './ChartGenerator';
import { layerEnergy, layerP90, layerStrengths, presentLayers, ringAt, type Layer, type LayerStrengths, type StemLayers } from './layers';
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

describe('presentLayers', () => {
  const idx = Array.from({ length: 64 }, (_, i) => i);

  it('lists the layers that really play, never one that is only separation bleed, however sharp its onsets look', () => {
    const sharpBleed = fakeLayers(
      4,
      (l, _b, step) => (l === 'vocals' ? (step % 2 === 0 ? 1 : 0) : step % 4 === 0 ? 1 : 0),
      (l) => (l === 'vocals' ? 0.01 : l === 'drums' ? 1 : 0.5),
    );
    const present = presentLayers(sharpBleed, idx);
    expect(present.has('vocals')).toBe(false);
    expect(present.has('drums') && present.has('bass') && present.has('other')).toBe(true);
    // A soft but present singer (15 % of the loudest stem) still counts.
    const softSinger = fakeLayers(
      4,
      (_l, _b, step) => (step % 4 === 0 ? 1 : 0),
      (l) => (l === 'vocals' ? 0.2 : 1),
    );
    expect(presentLayers(softSinger, idx).has('vocals')).toBe(true);
  });

  it('returns nothing when nothing plays', () => {
    expect(
      presentLayers(
        fakeLayers(
          4,
          () => 0,
          () => 0,
        ),
        idx,
      ).size,
    ).toBe(0);
  });
});

describe('ringAt', () => {
  it('rings while the energy keeps half the onset level and a fifth of the loud level, whatever the onsets do', () => {
    // A pad struck at slot 0 that decays over 6 slots, restruck at 8 with a flat tail to the bar end.
    const layers = fakeLayers(
      1,
      (l, _b, step) => (l === 'other' ? (step === 0 || step === 8 || step === 10 || step === 12 ? 1 : 0) : 0),
      (l, _b, step) => (l === 'other' ? (step <= 6 ? 1 - step * 0.1 : step >= 8 ? 1 : 0.05) : 0.02),
    );
    const p90 = layerP90(layers);
    expect(ringAt(layers, 'other', 0, p90)).toBe(5); // slot 6 is below half of the onset's energy
    expect(ringAt(layers, 'other', 8, p90)).toBe(7); // the repeated notes at 10 and 12 do not end the ring
    expect(ringAt(layers, 'drums', 0, p90)).toBe(0);
    // A tail below a fifth of the layer's loud level is not a note, however slowly it fades.
    const faint = fakeLayers(
      2,
      (l, _b, step) => (l === 'bass' && step === 0 ? 1 : 0),
      (l, bar, step) => (l === 'bass' ? (bar === 0 ? (step === 0 ? 1 : 0.9) : 0.15) : 0.02),
    );
    expect(ringAt(faint, 'bass', 16, layerP90(faint))).toBe(0);
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

  it('reports what it decided: the target, a level and a figure per phrase, the check', () => {
    let trace: ComposeTrace | undefined;
    const c = composeChart(analysis, { layers: vocal, targetStars: 4, onTrace: (t) => (trace = t) });
    expect(trace!.target).toBe(4);
    expect(trace!.levels).toHaveLength(bars / 4);
    expect(trace!.figures).toHaveLength(bars / 4);
    for (const f of trace!.figures) expect(f).toEqual([...f].sort((a, b) => a - b));
    // The chart carries the ★ it was composed under when it fits that budget; the check may read lower.
    expect(trace!.fails).toEqual([]);
    expect(c.stars).toBe(4);
    expect(trace!.stars).toBeLessThanOrEqual(c.stars);
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
      const c = composeChart(sustained, { layers: follow(layer), targetStars: 5 });
      expect(c.notes.length).toBeGreaterThan(48);
      expect(maxFingers(c.notes)).toBeLessThanOrEqual(2);
      expect(thumbViolations(c.notes, c.sections!)).toEqual([]);
      expect(() => assertPlayable(c, 0.125)).not.toThrow();
    }
  });

  it('reads every bar on its own: one figure per phrase, a tile only where the bar sounds it, nothing invented', () => {
    // The song hits a different figure in every bar — the phrase figure is their union, thinned to the budget.
    const figure = (bar: number): number[] =>
      [
        [0, 6, 10],
        [2, 8],
        [0, 4, 8, 12],
        [3, 9, 14],
      ][bar % 4];
    const song = fakeAnalysis(bars, (bar, step) => ({ strength: figure(bar).includes(step) ? 1 : 0.02 }));
    const c = composeChart(song, { targetStars: 5 });
    const lane = (notes: readonly NoteTuple[]) => notes.filter((n) => !n[3] || n[3] === 'slide' || n[3] === 'circle');
    const byBar = stepsByBar(song, lane(c.notes));
    const union = new Set<number>();
    let played = 0;
    for (let b = 0; b < bars; b++) {
      const got = byBar.get(b) ?? [];
      // Nothing may be invented: every tile is one of this bar's hits.
      for (const s of got) expect(figure(b), `bar ${b} step ${s}`).toContain(s);
      for (const s of got) union.add(s);
      if (got.length) played++;
    }
    expect(played).toBeGreaterThanOrEqual(bars / 2);
    expect(union.size).toBeLessThanOrEqual(6);
    // No odd sixteenth right beside an even step: sixteenth pairs do not exist.
    for (const s of union) if (s % 2 === 1) expect(union.has(s - 1) || union.has(s + 1)).toBe(false);
    // With stems, a present singer's own notes are hits too: tiles land on 5 and 13 as well, and nothing else moves.
    const sung = fakeLayers(
      bars,
      (l, _b, step) => (l === 'vocals' ? (step === 5 || step === 13 ? 1 : 0) : 0.05),
      (l) => (l === 'vocals' ? 1 : 0.02),
    );
    const withSinger = lane(composeChart(song, { targetStars: 5, layers: sung }).notes);
    let sungTiles = 0;
    for (const n of withSinger) {
      const slot = song.slots.find((s) => Math.abs(s.time - n[0]) < 1e-6)!;
      if (slot.step === 5 || slot.step === 13) sungTiles++;
      else expect(figure(slot.bar), `bar ${slot.bar} step ${slot.step}`).toContain(slot.step);
    }
    expect(sungTiles).toBeGreaterThan(0);
  });

  it('holds where an instrument rings for a beat or more: the ring is energy only, and the other thumb keeps tapping under it', () => {
    // Hits on beats 1 and 3; in even bars the lead rings from beat 1 for six slots, in odd bars it is a short stab.
    const song = fakeAnalysis(bars, (_b, s) => ({ strength: s % 8 === 0 ? 1 : 0.02, sustain: 0 }));
    const ringing = (bar: number, step: number) => bar % 2 === 0 && step <= 6;
    const lead = fakeLayers(
      bars,
      (l, _b, step) => (l === 'other' ? (step === 0 || step === 8 ? 1 : 0) : 0.05),
      (l, bar, step) => (l === 'other' ? (ringing(bar, step) || step === 8 ? 1 : 0.05) : 0.02),
    );
    const isHold = (n: NoteTuple) => n.length >= 3 && (n[2] as number) > 0 && n[3] !== 'spin' && n[3] !== 'roll';
    const c = composeChart(song, { layers: lead });
    const holds = c.notes.filter(isHold);
    expect(holds.length).toBeGreaterThanOrEqual(bars / 4);
    for (const h of holds) {
      const slot = song.slots.find((s) => Math.abs(s.time - h[0]) < 1e-6)!;
      expect(slot.step).toBe(0);
      expect(slot.bar % 2).toBe(0);
      expect(h[2]).toBeGreaterThanOrEqual(0.5);
      expect(h[2]).toBeLessThanOrEqual(0.75 + 1e-6); // the energy drops below half at slot 7
    }
    // The same lead over a kick on every beat: the hold goes on under the kick (one tap a beat on the other thumb) and the kicks stay taps.
    const kicks = fakeAnalysis(bars, (_b, s) => ({ strength: s % 4 === 0 ? 1 : 0.02, sustain: 0 }));
    const c2 = composeChart(kicks, { layers: lead });
    const holds2 = c2.notes.filter(isHold);
    expect(holds2.length).toBeGreaterThanOrEqual(bars / 4);
    for (const h of holds2) expect(h[2]).toBeGreaterThanOrEqual(0.5);
    const beats = c2.notes.filter((n) => !n[3] && !isHold(n)).map((n) => stepOf(kicks, n[0]));
    expect(beats.filter((s) => s === 4 || s === 12).length).toBeGreaterThan(bars);
    // A flat tail with restrikes in it is one long note: the ring does not break on a new onset, only on an energy drop.
    const flat = fakeLayers(
      bars,
      (l, _b, step) => (l === 'other' ? (step === 0 || step === 8 ? 1 : 0) : 0.05),
      (l, bar) => (l === 'other' ? (bar % 2 === 0 ? 1 : 0.05) : 0.02),
    );
    const c3 = composeChart(song, { layers: flat });
    const long = c3.notes.filter(isHold);
    expect(long.length).toBeGreaterThanOrEqual(bars / 4);
    expect(Math.max(...long.map((n) => n[2] as number))).toBeGreaterThanOrEqual(1.5);
    expect(thumbViolations(c3.notes, c3.sections!)).toEqual([]);
  });

  it('makes a chord only at ★5+, on a beat where two present instruments hit, with air around it, never in the first phrase', () => {
    const together = fakeLayers(
      bars,
      (l, _b, step) => (l === 'vocals' ? (step === 0 ? 1 : step === 4 || step === 8 || step === 12 ? 0.5 : 0) : l === 'drums' ? (step === 0 ? 1 : 0) : 0),
      (l, _b, step) => (l === 'vocals' || l === 'drums' ? (step === 0 ? 1 : step % 4 === 0 ? 0.5 : 0.05) : 0.02), // short notes: nothing rings into a hold
    );
    // A mix of beats (the eighths are too soft for the figure): four tiles a bar leave room in the windows for a chord.
    const beats = fakeAnalysis(bars, (_b, step) => ({ strength: step % 4 === 0 ? 1 : 0.3, low: 0.6, mid: 0.3, high: 0.4 }));
    const c = composeChart(beats, { layers: together, targetStars: 5 });
    const chords = [...new Set(c.notes.map((n) => n[0]).filter((x, i, all) => all.indexOf(x) !== i))];
    expect(chords.length).toBeGreaterThan(0);
    expect(chords.length).toBeLessThanOrEqual(bars - 4);
    for (const x of chords) {
      const slot = beats.slots.find((s) => Math.abs(s.time - x) < 1e-6)!;
      expect(slot.step).toBe(0);
      expect(slot.bar).toBeGreaterThanOrEqual(4);
      const neighbours = c.notes.filter((n) => n[0] !== x && Math.abs(n[0] - x) < 0.25 - 1e-6);
      expect(neighbours).toEqual([]);
    }
    expect(twoAtOnce(c.notes)).toBe(true);
    // Below ★5 the same music has no chords; nor does the singer alone (no second instrument).
    expect(twoAtOnce(composeChart(beats, { layers: together, targetStars: 4 }).notes)).toBe(false);
    const alone = fakeLayers(bars, (l, _b, step) => (l === 'vocals' ? (step === 0 ? 1 : step % 4 === 0 ? 0.5 : 0) : 0.05));
    expect(twoAtOnce(composeChart(beats, { layers: alone, targetStars: 5 }).notes)).toBe(false);
  });

  it('changes the lane count only where a drop opens, in 8-bar blocks of at least 16 bars', () => {
    const long = 64;
    const oneVoice = fakeLayers(long, (l, _b, step) => (l === 'vocals' ? (step % 4 === 0 ? 1 : 0) : 0.05));
    // Nothing changes in the music: one section.
    const steady = fakeAnalysis(long, drumMix);
    expect(composeChart(steady, { layers: oneVoice, targetStars: 5 }).sections).toEqual([[0, 5]]);
    // A quiet intro, the drop at bar 16, a quiet verse in bars 32–47, the drop again: the field opens to five
    // lanes at the drop and keeps them — a verse never re-shapes the field, so the whole song is two sections.
    const verse = fakeAnalysis(long, (bar, step) => {
      const s = drumMix(bar, step);
      return bar < 16 || (bar >= 32 && bar < 48) ? { ...s, strength: (s.strength ?? 0) * 0.3 } : s;
    });
    let trace: ComposeTrace | undefined;
    const c2 = composeChart(verse, { layers: oneVoice, targetStars: 5, seed: 3, onTrace: (t) => (trace = t) });
    const barsAt = c2.sections!.map(([time]) => Math.round(time / 2));
    expect(barsAt).toEqual([0, 16]);
    expect(c2.sections!.map(([, lanes]) => lanes)).toEqual([4, 5]);
    expect(trace!.levels.slice(0, 4).every((l) => l < 2)).toBe(true);
    expect(trace!.levels.slice(8, 12).every((l) => l < 2)).toBe(true);
    for (let i = 1; i < barsAt.length; i++) {
      expect(barsAt[i] % 8).toBe(0);
      expect(barsAt[i] - barsAt[i - 1]).toBeGreaterThanOrEqual(16);
    }
  });

  it('is deterministic and still on the grid', () => {
    const again = composeChart(analysis, { layers: vocal });
    expect(again.notes).toEqual(withVoice.notes);
    const times = new Set(analysis.slots.map((s) => s.time));
    for (const n of withVoice.notes) expect(times.has(n[0])).toBe(true);
  });
});
