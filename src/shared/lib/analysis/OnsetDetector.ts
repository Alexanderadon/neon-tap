import { RealFFT } from './fft';

export interface Onset {
  /** Seconds from the start of the signal. */
  time: number;
  /** Spectral-flux peak height, normalised to [0, 1] over the whole track. */
  strength: number;
  /** Share of the flux in low (20–250 Hz), mid (250–2000 Hz), high (>2000 Hz) bands; sums to 1. */
  bands: [number, number, number];
}

export interface OnsetOptions {
  sampleRate: number;
  frameSize?: number;
  hop?: number;
  /** Adaptive threshold = local mean × ratio (GDD: 1.5). */
  thresholdRatio?: number;
  /** Half-width of the local-mean window, in frames. */
  meanWindow?: number;
  /** Minimum distance between two onsets, seconds. */
  minGap?: number;
  onProgress?: (fraction: number) => void;
}

export interface OnsetResult {
  onsets: Onset[];
  /** Raw spectral flux per frame — the onset-strength envelope used by the BPM estimator and beat tracker. */
  flux: Float32Array;
  /** Flux split by band: low (20–250 Hz), mid (250–2000 Hz), high (>2000 Hz). */
  bandFlux: [Float32Array, Float32Array, Float32Array];
  /** Mid-band (250–2000 Hz) magnitude per frame — sustained melodic energy, used for hold notes. */
  midEnergy: Float32Array;
  hopSeconds: number;
  frameCount: number;
  /** Seconds at the (lag-corrected) centre of frame `f`; same convention as onset times. */
  frameTime: (f: number) => number;
  /** Inverse of frameTime. */
  timeToFrame: (t: number) => number;
}

const BAND_EDGES_HZ = [20, 250, 2000] as const;

/**
 * Spectral-flux onset detection.
 *
 * 1. STFT with Hann window (frame 1024, hop 512 by default).
 * 2. Flux = Σ max(0, log(1+10|X_t[k]|) − log(1+10|X_{t−1}[k]|)) over bins (half-wave rectified).
 * 3. Adaptive threshold: local mean × ratio. Peaks above it that are local maxima become onsets.
 */
export function detectOnsets(samples: Float32Array, opts: OnsetOptions): OnsetResult {
  const frameSize = opts.frameSize ?? 1024;
  const hop = opts.hop ?? 512;
  const ratio = opts.thresholdRatio ?? 1.5;
  const meanWindow = opts.meanWindow ?? 10;
  const minGap = opts.minGap ?? 0.05;
  const sr = opts.sampleRate;
  const hopSeconds = hop / sr;
  // The flux peak lags the true attack by about half a hop.
  const frameTime = (f: number): number => (f * hop + frameSize / 2) / sr - hopSeconds / 2;
  const timeToFrame = (t: number): number => ((t + hopSeconds / 2) * sr - frameSize / 2) / hop;

  const fft = new RealFFT(frameSize);
  const bins = (frameSize >> 1) + 1;
  const prev = new Float32Array(bins);
  const cur = new Float32Array(bins);
  const frame = new Float32Array(frameSize);

  const frameCount = Math.max(0, Math.floor((samples.length - frameSize) / hop) + 1);
  const flux = new Float32Array(frameCount);
  const bandFlux: [Float32Array, Float32Array, Float32Array] = [new Float32Array(frameCount), new Float32Array(frameCount), new Float32Array(frameCount)];
  const midEnergy = new Float32Array(frameCount);

  const binHz = sr / frameSize;
  const lowStart = Math.max(1, Math.round(BAND_EDGES_HZ[0] / binHz));
  const midStart = Math.round(BAND_EDGES_HZ[1] / binHz);
  const highStart = Math.round(BAND_EDGES_HZ[2] / binHz);

  for (let f = 0; f < frameCount; f++) {
    frame.set(samples.subarray(f * hop, f * hop + frameSize));
    fft.magnitudes(frame, cur);
    let total = 0;
    let low = 0;
    let mid = 0;
    let high = 0;
    let midSum = 0;
    for (let k = lowStart; k < bins; k++) {
      if (k >= midStart && k < highStart) midSum += cur[k];
      const d = Math.log1p(cur[k] * 10) - Math.log1p(prev[k] * 10);
      if (d > 0) {
        total += d;
        if (k < midStart) low += d;
        else if (k < highStart) mid += d;
        else high += d;
      }
    }
    flux[f] = total;
    bandFlux[0][f] = low;
    bandFlux[1][f] = mid;
    bandFlux[2][f] = high;
    midEnergy[f] = midSum;
    prev.set(cur);
    if (opts.onProgress && (f & 255) === 0) opts.onProgress(f / frameCount);
  }

  // Adaptive threshold via running mean.
  const onsets: Onset[] = [];
  let lastOnsetTime = -Infinity;
  let maxFlux = 0;
  for (let f = 0; f < frameCount; f++) if (flux[f] > maxFlux) maxFlux = flux[f];
  const eps = maxFlux * 0.02;

  for (let f = 1; f < frameCount - 1; f++) {
    const from = Math.max(0, f - meanWindow);
    const to = Math.min(frameCount, f + meanWindow + 1);
    let sum = 0;
    for (let i = from; i < to; i++) sum += flux[i];
    const threshold = (sum / (to - from)) * ratio + eps;
    const v = flux[f];
    if (v < threshold) continue;
    if (v < flux[f - 1] || v < flux[f + 1]) continue;
    if (f >= 2 && v < flux[f - 2]) continue;
    if (f + 2 < frameCount && v < flux[f + 2]) continue;
    const time = frameTime(f);
    if (time - lastOnsetTime < minGap) continue;
    lastOnsetTime = time;
    const l = bandFlux[0][f];
    const m = bandFlux[1][f];
    const h = bandFlux[2][f];
    const s = l + m + h || 1;
    onsets.push({ time, strength: v, bands: [l / s, m / s, h / s] });
  }

  // Normalise strength to [0, 1].
  let max = 0;
  for (const o of onsets) if (o.strength > max) max = o.strength;
  if (max > 0) for (const o of onsets) o.strength /= max;

  opts.onProgress?.(1);
  return { onsets, flux, bandFlux, midEnergy, hopSeconds, frameCount, frameTime, timeToFrame };
}
