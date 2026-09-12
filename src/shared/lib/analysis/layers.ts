import { detectOnsets } from './OnsetDetector';
import { percentile } from '@/shared/lib/math';
import type { SongAnalysis } from './SongAnalyzer';

/** Instrument layers a chart can follow, from the separated stems. */
export const LAYERS = ['vocals', 'drums', 'bass', 'other'] as const;
export type Layer = (typeof LAYERS)[number];

/** Per-slot values (0..1) of every layer on the song's own sixteenth grid. */
export type LayerStrengths = Record<Layer, Float32Array>;

/**
 * What the separated stems say about every grid slot: `onset` — where the instrument hits (its own
 * scale, so a soft singer still reads as full notes); `energy` — how loud it is there (absolute, so
 * the layers can be compared and separation bleed is recognised as absence).
 */
export interface StemLayers {
  onset: LayerStrengths;
  energy: LayerStrengths;
}

/**
 * Onset strength of one stem sampled on the analysed grid: for every slot, the strongest flux
 * frame within ±1.5 frames of the slot (the same rule SongAnalyzer uses for the mix), normalised
 * to the stem's own 95th percentile so a quiet stem still shows where it plays.
 */
export function layerStrengths(samples: Float32Array, sampleRate: number, analysis: SongAnalysis): Float32Array {
  const det = detectOnsets(samples, { sampleRate });
  const out = new Float32Array(analysis.slots.length);
  const n = det.frameCount;
  for (let s = 0; s < out.length; s++) {
    const f = det.timeToFrame(analysis.slots[s].time);
    const from = Math.max(0, Math.floor(f - 1.5));
    const to = Math.min(n - 1, Math.ceil(f + 1.5));
    let best = 0;
    for (let j = from; j <= to; j++) if (det.flux[j] > best) best = det.flux[j];
    out[s] = best;
  }
  const norm =
    percentile(
      [...out].filter((v) => v > 0),
      0.95,
    ) || 1;
  for (let s = 0; s < out.length; s++) out[s] = Math.min(1, out[s] / norm);
  return out;
}

/** RMS of one stem over every slot (slot start to the next slot), in absolute sample units. */
export function layerEnergy(samples: Float32Array, sampleRate: number, analysis: SongAnalysis): Float32Array {
  const slots = analysis.slots;
  const out = new Float32Array(slots.length);
  for (let s = 0; s < slots.length; s++) {
    const from = Math.max(0, Math.floor(slots[s].time * sampleRate));
    const to = Math.min(samples.length, Math.floor((slots[s + 1]?.time ?? slots[s].time + 0.125) * sampleRate));
    if (to <= from) continue;
    let sum = 0;
    for (let i = from; i < to; i++) sum += samples[i] * samples[i];
    out[s] = Math.sqrt(sum / (to - from));
  }
  return out;
}

/** A layer-driven phrase is scaled so its 90th-percentile hit reaches this salience (same idea as the quiet-phrase boost). */
export const BOOST_TARGET_LAYER = 0.7;

/** A sound keeps ringing while its layer's energy stays above this share of the onset slot's energy… */
const HOLD_KEEP = 0.45;
/** …and no new sound of that layer (an onset peak above this) starts. */
const ONSET_BREAK = 0.3;
const SUSTAIN_MAX = 16;

/** A ringing tail must also stay above this share of the layer's loud level (its 90th percentile) — a faint decay is not a note. */
const HOLD_FLOOR = 0.2;

/** The level a layer's tail must keep to count as ringing: HOLD_FLOOR of its loud moments. */
export function sustainFloor(layers: StemLayers, layer: Layer): number {
  return (
    HOLD_FLOOR *
    percentile(
      [...layers.energy[layer]].filter((v) => v > 0),
      0.9,
    )
  );
}

/**
 * How long the sound starting at `si` rings, in slots (0 = a short hit): the layer's energy holds
 * up (relative to the onset and above `floor`, see sustainFloor) and no new onset of the same
 * layer interrupts. Drums never sustain.
 */
export function soundSustain(layers: StemLayers, layer: Layer, si: number, floor = 0): number {
  if (layer === 'drums') return 0;
  const e = layers.energy[layer];
  const o = layers.onset[layer];
  const base = e[si];
  if (!(base > 0)) return 0;
  let n = 0;
  for (let j = si + 1; j < e.length && n < SUSTAIN_MAX; j++) {
    if (e[j] < floor) break;
    // A new sound is a peak of its own; the shoulder of the onset that started this note is not.
    const newSound = o[j] >= ONSET_BREAK && o[j] >= (o[j - 1] ?? 0) && o[j] >= (o[j + 1] ?? 0);
    if (e[j] < HOLD_KEEP * base || newSound) break;
    n++;
  }
  return n;
}

/** Weight of a melodic layer when phrases pick what the player follows: the singer first, then the lead, then the bass line. */
export const LAYER_WEIGHT: Record<Layer, number> = { vocals: 1.35, other: 1.0, bass: 0.7, drums: 0.5 };
/** The layers a tile can be a note of. Drums are followed only where no melody plays (a break, a drum intro). */
const MELODIC: readonly Layer[] = ['vocals', 'other', 'bass'];

/** A layer counts as playing in a phrase when its energy there is at least this share of the loudest layer's. */
export const PRESENCE_REL = 0.15;
/** A phrase is judged by its clearest hits: this many peaks (two per bar), so a busy hi-hat does not outvote a melody. */
const TOP_PEAKS = 8;
/** A melodic layer leads when its clearest hits add up to at least this (a few clear notes in the phrase). */
const MELODY_MIN = 1.5;

/**
 * Which layer a phrase follows — the Magic Tiles rule: the tiles are the melody. Among the layers
 * actually playing (by energy), the melodic one whose clearest onset peaks carry the most weighted
 * strength (TOP_PEAKS of them, so a busy layer gets no credit for being busy) leads: the singer,
 * else the lead instrument, else the bass line. Drums lead only where nothing melodic plays.
 * `slots` are the phrase's global slot indices. Returns null when nothing is audible.
 */
export function pickLayer(layers: StemLayers, slots: readonly number[], minTotal = 0.6): Layer | null {
  const mean = {} as Record<Layer, number>;
  let loudest = 0;
  for (const name of LAYERS) {
    let sum = 0;
    for (const s of slots) sum += layers.energy[name][s] ?? 0;
    mean[name] = slots.length ? sum / slots.length : 0;
    loudest = Math.max(loudest, mean[name]);
  }
  const scored: { name: Layer; score: number }[] = [];
  for (const name of LAYERS) {
    if (loudest <= 0 || mean[name] < PRESENCE_REL * loudest) continue;
    const v = layers.onset[name];
    const peaks: number[] = [];
    for (const s of slots) {
      const x = v[s];
      if (x <= 0.15) continue;
      if (x >= (v[s - 1] ?? 0) && x >= (v[s + 1] ?? 0)) peaks.push(x);
    }
    peaks.sort((a, b) => b - a);
    const score = peaks.slice(0, TOP_PEAKS).reduce((a, b) => a + b, 0) * LAYER_WEIGHT[name];
    if (score > 0) scored.push({ name, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const melody = scored.find((s) => MELODIC.includes(s.name) && s.score >= MELODY_MIN);
  if (melody) return melody.name;
  if (!scored.length || scored[0].score < minTotal) return null;
  return scored[0].name;
}
