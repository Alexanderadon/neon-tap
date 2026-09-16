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

/** Layers whose sounds can ring on (holds); drums never sustain. */
export const MELODIC_LAYERS: readonly Layer[] = ['vocals', 'other', 'bass'];

/** A layer counts as playing in a phrase when its energy there is at least this share of the loudest layer's. */
export const PRESENCE_REL = 0.15;

/**
 * Which layers actually play over `slots` (a phrase's global slot indices): mean energy at least
 * `PRESENCE_REL` of the loudest layer's. Separation bleed — the 2–5 % "vocals" of an instrumental —
 * is absent: it never gives a hit, a hold or a chord.
 */
export function presentLayers(layers: StemLayers, slots: readonly number[]): Set<Layer> {
  const mean = {} as Record<Layer, number>;
  let loudest = 0;
  for (const name of LAYERS) {
    let sum = 0;
    for (const s of slots) sum += layers.energy[name][s] ?? 0;
    mean[name] = slots.length ? sum / slots.length : 0;
    loudest = Math.max(loudest, mean[name]);
  }
  const out = new Set<Layer>();
  for (const name of LAYERS) if (loudest > 0 && mean[name] >= PRESENCE_REL * loudest) out.add(name);
  return out;
}

/** A sound keeps ringing while its layer's energy stays above this share of the onset slot's energy… */
const RING_KEEP = 0.5;
/** …and above this share of the layer's loud level (its 90th percentile) — a faint decay is not a note. */
const RING_FLOOR = 0.2;
const SUSTAIN_MAX = 16;

/** The loud level of every layer: the 90th percentile of its non-zero energy (`ringAt` measures tails against it). */
export function layerP90(layers: StemLayers): Record<Layer, number> {
  const out = {} as Record<Layer, number>;
  for (const name of LAYERS)
    out[name] = percentile(
      [...layers.energy[name]].filter((v) => v > 0),
      0.9,
    );
  return out;
}

/**
 * How long the sound of `layer` starting at `si` rings, in slots (0 = a short hit): energy only —
 * the layer keeps `RING_KEEP` of the onset slot's energy and `RING_FLOOR` of its loud level. A new
 * onset of the same instrument does not end the ring: repeated notes of one instrument merge into
 * one long tile (the Piano-Tiles reading). Drums never ring.
 */
export function ringAt(layers: StemLayers, layer: Layer, si: number, p90: Record<Layer, number>): number {
  if (layer === 'drums') return 0;
  const e = layers.energy[layer];
  const base = e[si];
  if (!(base > 0)) return 0;
  const floor = RING_FLOOR * p90[layer];
  let n = 0;
  for (let j = si + 1; j < e.length && n < SUSTAIN_MAX; j++) {
    if (e[j] < RING_KEEP * base || e[j] < floor) break;
    n++;
  }
  return n;
}
