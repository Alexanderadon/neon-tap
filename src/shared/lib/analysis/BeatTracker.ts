import { median } from '@/shared/lib/math';

/**
 * Dynamic-programming beat tracker (Ellis 2007, the algorithm behind librosa.beat.beat_track).
 *
 * Given a tempo estimate, finds the sequence of frames that maximises
 *   Σ onsetStrength(beat_i) − tightness · Σ log²(Δt_i / period)
 * i.e. beats sit on strong onsets *and* keep a steady spacing. Unlike snapping to a fixed
 * BPM grid, this follows the actual music, so a 0.3 BPM tempo error no longer drifts a
 * sixteenth over three minutes.
 *
 * @returns fractional frame indices of beats, in ascending order (empty when nothing is found).
 */
export function trackBeats(flux: Float32Array, hopSeconds: number, bpm: number, tightness = 100): number[] {
  const n = flux.length;
  if (n < 8 || !(bpm > 0)) return [];
  const period = 60 / bpm / hopSeconds; // frames per beat

  // Local score: flux normalised by its std, smoothed with a narrow Gaussian.
  let mean = 0;
  for (let i = 0; i < n; i++) mean += flux[i];
  mean /= n;
  let variance = 0;
  for (let i = 0; i < n; i++) variance += (flux[i] - mean) ** 2;
  const std = Math.sqrt(variance / Math.max(1, n - 1));
  if (std === 0) return [];
  const half = Math.max(1, Math.round(period));
  const g = new Float32Array(2 * half + 1);
  for (let k = -half; k <= half; k++) g[k + half] = Math.exp(-0.5 * ((k * 32) / period) ** 2);
  const local = new Float32Array(n);
  let localMax = 0;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -half; k <= half; k++) {
      const j = i + k;
      if (j < 0 || j >= n) continue;
      s += (flux[j] / std) * g[k + half];
    }
    local[i] = s;
    if (s > localMax) localMax = s;
  }

  // Transition weights over the allowed inter-beat interval [period/2, 2·period].
  const minOff = -Math.round(2 * period);
  const maxOff = -Math.max(1, Math.round(period / 2));
  const offsets: number[] = [];
  const txwt: number[] = [];
  for (let o = minOff; o <= maxOff; o++) {
    offsets.push(o);
    txwt.push(-tightness * Math.log(-o / period) ** 2);
  }

  const cum = new Float64Array(n);
  const backlink = new Int32Array(n).fill(-1);
  let firstBeat = true;
  const threshold = 0.01 * localMax;
  for (let i = 0; i < n; i++) {
    let best = -Infinity;
    let bestK = -1;
    for (let j = 0; j < offsets.length; j++) {
      const k = i + offsets[j];
      const c = txwt[j] + (k >= 0 ? cum[k] : 0);
      if (c > best) {
        best = c;
        bestK = k;
      }
    }
    cum[i] = local[i] + best;
    if (firstBeat && local[i] < threshold) backlink[i] = -1;
    else {
      backlink[i] = bestK;
      firstBeat = false;
    }
  }

  // Last beat: the last local maximum of the cumulative score above half the median peak.
  const peaks: number[] = [];
  for (let i = 1; i < n - 1; i++) if (cum[i] > cum[i - 1] && cum[i] >= cum[i + 1]) peaks.push(i);
  if (peaks.length === 0) return [];
  const medPeak = median(peaks.map((i) => cum[i]));
  let tail = -1;
  for (const i of peaks) if (cum[i] >= 0.5 * medPeak) tail = i;
  if (tail < 0) return [];

  const beats: number[] = [];
  for (let b = tail; b >= 0; b = backlink[b]) beats.push(b);
  beats.reverse();

  // Trim weak beats at both ends (leading/trailing silence).
  if (beats.length >= 5) {
    const boe = beats.map((b) => local[b]);
    const smooth = boe.map((_, i) => 0.25 * (boe[i - 1] ?? boe[i]) + 0.5 * boe[i] + 0.25 * (boe[i + 1] ?? boe[i]));
    let rms = 0;
    for (const v of smooth) rms += v * v;
    const thr = 0.5 * Math.sqrt(rms / smooth.length);
    let first = 0;
    while (first < beats.length - 1 && smooth[first] <= thr) first++;
    let last = beats.length - 1;
    while (last > first && smooth[last] <= thr) last--;
    beats.splice(last + 1);
    beats.splice(0, first);
  }

  return beats.map((b) => refinePeak(flux, b));
}

/** Snap to the strongest of the ±1 neighbouring frames, then parabolic interpolation for sub-frame precision. */
function refinePeak(flux: Float32Array, b: number): number {
  const n = flux.length;
  let best = b;
  for (const j of [b - 1, b + 1]) if (j >= 0 && j < n && flux[j] > flux[best]) best = j;
  if (best <= 0 || best >= n - 1) return best;
  const a = flux[best - 1];
  const m = flux[best];
  const c = flux[best + 1];
  const denom = a - 2 * m + c;
  if (denom >= 0) return best;
  const delta = (0.5 * (a - c)) / denom;
  return best + Math.max(-1, Math.min(1, delta));
}

/**
 * Downbeat phase for 4/4: which of the four beat positions carries the most low-band
 * (kick) and overall onset energy. Returns 0..3 — the index of the first downbeat in `beatFrames`.
 */
export function estimateDownbeatPhase(beatFrames: readonly number[], lowFlux: Float32Array, flux: Float32Array): number {
  const scores = [0, 0, 0, 0];
  const n = flux.length;
  for (let i = 0; i < beatFrames.length; i++) {
    const f = Math.round(beatFrames[i]);
    let v = 0;
    for (let j = f - 1; j <= f + 1; j++) if (j >= 0 && j < n) v = Math.max(v, lowFlux[j] + 0.3 * flux[j]);
    scores[i % 4] += v;
  }
  let best = 0;
  for (let p = 1; p < 4; p++) if (scores[p] > scores[best]) best = p;
  return best;
}
