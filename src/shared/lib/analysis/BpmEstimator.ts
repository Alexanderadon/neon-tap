export interface BpmEstimate {
  bpm: number;
  /** Seconds from signal start to the first beat of the grid. */
  offset: number;
  /** 0..1 — peak autocorrelation relative to the zero lag. */
  confidence: number;
}

export interface BpmOptions {
  minBpm?: number;
  maxBpm?: number;
  /** Tempos in this range are preferred when octave-ambiguous (60 vs 120 vs 240). */
  preferredRange?: [number, number];
}

/**
 * Tempo estimation by autocorrelation of the onset-strength envelope (spectral flux).
 *
 * Autocorrelation on the continuous envelope is more robust than a histogram of
 * inter-onset intervals: it needs no onset picking threshold and averages over the whole track.
 */
export function estimateBpm(flux: Float32Array, hopSeconds: number, opts: BpmOptions = {}): BpmEstimate {
  const minBpm = opts.minBpm ?? 60;
  const maxBpm = opts.maxBpm ?? 220;
  const [prefLo, prefHi] = opts.preferredRange ?? [90, 180];
  const n = flux.length;
  if (n < 16) return { bpm: 120, offset: 0, confidence: 0 };

  // Mean-remove and half-wave rectify to emphasise attacks.
  let mean = 0;
  for (let i = 0; i < n; i++) mean += flux[i];
  mean /= n;
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) env[i] = Math.max(0, flux[i] - mean);

  let zero = 0;
  for (let i = 0; i < n; i++) zero += env[i] * env[i];
  if (zero === 0) return { bpm: 120, offset: 0, confidence: 0 };

  const minLag = Math.max(1, Math.floor(60 / maxBpm / hopSeconds));
  const maxLag = Math.min(n - 1, Math.ceil(60 / minBpm / hopSeconds));
  const ac = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = lag; i < n; i++) s += env[i] * env[i - lag];
    ac[lag] = s / zero;
  }

  // Score each lag; add a mild preference for the musically typical range and
  // reward lags whose double/half also correlate (true beat period, not a sub-division).
  let bestLag = minLag;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = 60 / (lag * hopSeconds);
    let score = ac[lag];
    const dbl = lag * 2;
    if (dbl <= maxLag) score += 0.5 * ac[dbl];
    const half = lag >> 1;
    if (half >= minLag) score += 0.25 * ac[half];
    if (bpm >= prefLo && bpm <= prefHi) score *= 1.15;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  // Parabolic interpolation around the peak for sub-hop precision.
  let lag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const a = ac[bestLag - 1];
    const b = ac[bestLag];
    const c = ac[bestLag + 1];
    const denom = a - 2 * b + c;
    if (denom !== 0) lag = bestLag + (0.5 * (a - c)) / denom;
  }

  let bpm = 60 / (lag * hopSeconds);
  // Fold into the preferred range when it lands outside.
  while (bpm < prefLo && bpm * 2 <= maxBpm) bpm *= 2;
  while (bpm > prefHi && bpm / 2 >= minBpm) bpm /= 2;

  const period = 60 / bpm;
  const offset = estimatePhase(env, hopSeconds, period);
  return { bpm: Math.round(bpm * 10) / 10, offset, confidence: Math.min(1, ac[bestLag]) };
}

/** Beat phase: shift of the grid (in seconds) maximising envelope energy on grid points. */
function estimatePhase(env: Float32Array, hopSeconds: number, period: number): number {
  const periodFrames = period / hopSeconds;
  const steps = Math.max(1, Math.round(periodFrames));
  let best = 0;
  let bestSum = -1;
  for (let s = 0; s < steps; s++) {
    let sum = 0;
    for (let t = s; t < env.length; t += periodFrames) {
      const i = Math.round(t);
      if (i < env.length) sum += env[i];
    }
    if (sum > bestSum) {
      bestSum = sum;
      best = s;
    }
  }
  return best * hopSeconds;
}
