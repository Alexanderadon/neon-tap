import { median, percentile } from '@/shared/lib/math';
import { detectOnsets } from './OnsetDetector';
import { estimateBpm } from './BpmEstimator';
import { estimateDownbeatPhase, trackBeats } from './BeatTracker';

export const STEPS_PER_BEAT = 4;
export const BEATS_PER_BAR = 4;
export const STEPS_PER_BAR = STEPS_PER_BEAT * BEATS_PER_BAR;

/** One sixteenth-note position on the tracked beat grid, with what the music does there. */
export interface Slot {
  time: number;
  bar: number;
  /** 0..15 within the bar (0 = downbeat, 4 = beat 2, …). */
  step: number;
  /** Onset strength at this slot, 0..1 (normalised to the track's 95th percentile). */
  strength: number;
  /** Band shares of that onset; sum to 1. */
  low: number;
  mid: number;
  high: number;
  /** How many following slots keep ≥ 50 % of this slot's mid-band energy — a sustained sound. */
  sustain: number;
}

export interface SongAnalysis {
  bpm: number;
  confidence: number;
  /** Beat times in seconds, starting on a downbeat, covering the whole track. */
  beats: number[];
  slots: Slot[];
  barCount: number;
  duration: number;
  onsetCount: number;
}

export type AnalysisStage = 'onsets' | 'beats' | 'grid';

/**
 * Full musical analysis: onsets → tempo → beat tracking → downbeats → sixteenth grid with
 * per-slot onset strength, band colour and sustain. Everything downstream (chart composition)
 * works on this grid, which is why every note lands exactly on the beat.
 */
export function analyzeSong(samples: Float32Array, sampleRate: number, onProgress?: (stage: AnalysisStage, fraction: number) => void): SongAnalysis {
  const det = detectOnsets(samples, { sampleRate, onProgress: (f) => onProgress?.('onsets', f) });
  const duration = samples.length / sampleRate;
  const est = estimateBpm(det.flux, det.hopSeconds);
  onProgress?.('beats', 0);

  let beatFrames = trackBeats(det.flux, det.hopSeconds, est.bpm);
  const nominalPeriod = 60 / est.bpm / det.hopSeconds;
  if (beatFrames.length < 4) {
    // Tracking failed (silence / noise): fall back to a regular grid from the tempo estimate.
    beatFrames = [];
    for (let f = det.timeToFrame(est.offset); f < det.frameCount; f += nominalPeriod) if (f >= 0) beatFrames.push(f);
  }
  const period = beatFrames.length >= 2 ? median(beatFrames.slice(1).map((b, i) => b - beatFrames[i])) : nominalPeriod;

  // Extend the tracked beats over the whole track so intro/outro notes have a grid too.
  const extended = [...beatFrames];
  while (extended[0] - period >= det.timeToFrame(0)) extended.unshift(extended[0] - period);
  const lastFrame = det.timeToFrame(duration);
  while (extended[extended.length - 1] + period <= lastFrame + period * 0.5) extended.push(extended[extended.length - 1] + period);

  // Start the list on a downbeat.
  const phase = estimateDownbeatPhase(extended, det.bandFlux[0], det.flux);
  const aligned = extended.slice(phase);
  while (aligned[0] - BEATS_PER_BAR * period >= det.timeToFrame(0)) aligned.unshift(aligned[0] - BEATS_PER_BAR * period);
  onProgress?.('beats', 1);
  onProgress?.('grid', 0);

  // Sixteenth grid between consecutive beats.
  const slots: Slot[] = [];
  const slotFrames: number[] = [];
  for (let i = 0; i < aligned.length - 1; i++) {
    const a = aligned[i];
    const b = aligned[i + 1];
    for (let k = 0; k < STEPS_PER_BEAT; k++) {
      const frame = a + ((b - a) * k) / STEPS_PER_BEAT;
      slotFrames.push(frame);
      slots.push({ time: det.frameTime(frame), bar: Math.floor(i / BEATS_PER_BAR), step: (i % BEATS_PER_BAR) * STEPS_PER_BEAT + k, strength: 0, low: 0, mid: 0, high: 0, sustain: 0 });
    }
  }
  const n = det.frameCount;
  const raw: number[] = [];
  for (let s = 0; s < slots.length; s++) {
    const f = slotFrames[s];
    const from = Math.max(0, Math.floor(f - 1.5));
    const to = Math.min(n - 1, Math.ceil(f + 1.5));
    let best = 0;
    let bestF = -1;
    for (let j = from; j <= to; j++) {
      if (det.flux[j] > best) {
        best = det.flux[j];
        bestF = j;
      }
    }
    raw.push(best);
    if (bestF >= 0) {
      const l = det.bandFlux[0][bestF];
      const m = det.bandFlux[1][bestF];
      const h = det.bandFlux[2][bestF];
      const sum = l + m + h || 1;
      slots[s].low = l / sum;
      slots[s].mid = m / sum;
      slots[s].high = h / sum;
    }
  }
  const norm = percentile(raw.filter((v) => v > 0), 0.95) || 1;
  for (let s = 0; s < slots.length; s++) slots[s].strength = Math.min(1, raw[s] / norm);

  // Sustain: mean mid-band energy per slot, then count following slots that keep ≥ 50 % of it.
  const midPerSlot = new Float32Array(slots.length);
  for (let s = 0; s < slots.length; s++) {
    const from = Math.max(0, Math.round(slotFrames[s]));
    const to = Math.min(n, Math.round(s + 1 < slots.length ? slotFrames[s + 1] : slotFrames[s] + period / STEPS_PER_BEAT));
    let sum = 0;
    let count = 0;
    for (let j = from; j < to; j++) {
      sum += det.midEnergy[j];
      count++;
    }
    midPerSlot[s] = count ? sum / count : 0;
  }
  const floor = percentile([...midPerSlot], 0.3);
  for (let s = 0; s < slots.length; s++) {
    const e0 = midPerSlot[s];
    if (e0 <= floor || e0 === 0) continue;
    let k = 1;
    while (s + k < slots.length && k < STEPS_PER_BAR && midPerSlot[s + k] >= 0.5 * e0) k++;
    slots[s].sustain = k - 1;
  }
  onProgress?.('grid', 1);

  return {
    bpm: est.bpm,
    confidence: est.confidence,
    beats: aligned.map((f) => Math.round(det.frameTime(f) * 1000) / 1000),
    slots,
    barCount: slots.length ? slots[slots.length - 1].bar + 1 : 0,
    duration,
    onsetCount: det.onsets.length,
  };
}
