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

/** Weight of a layer when phrases pick what the player follows: a singer beats a hi-hat. */
export const LAYER_WEIGHT: Record<Layer, number> = { vocals: 1.35, other: 1.0, drums: 0.95, bass: 0.8 };

/** A layer counts as playing in a phrase when its energy there is at least this share of the loudest layer's. */
export const PRESENCE_REL = 0.15;

/**
 * Which layer a phrase follows: among the layers actually playing there (by energy), the one whose
 * onset peaks carry the most weighted strength. `slots` are the phrase's global slot indices.
 * Returns null when nothing is audible.
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
  let best: Layer | null = null;
  let bestScore = 0;
  for (const name of LAYERS) {
    if (loudest <= 0 || mean[name] < PRESENCE_REL * loudest) continue;
    const v = layers.onset[name];
    let score = 0;
    for (const s of slots) {
      const x = v[s];
      if (x <= 0.15) continue;
      const peak = x >= (v[s - 1] ?? 0) && x >= (v[s + 1] ?? 0);
      if (peak) score += x;
    }
    score *= LAYER_WEIGHT[name];
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }
  return bestScore >= minTotal ? best : null;
}
