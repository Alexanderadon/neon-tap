/** Pitch range the detector looks for: from a low bass note to a high sung note. */
const F_MIN = 55;
const F_MAX = 1400;
/** Analysis window in seconds (≈ 93 ms at 22 050 Hz): long enough for the lowest notes, short enough for a sung syllable. */
const WINDOW_SEC = 0.093;
/** A candidate lag must reach this share of the best normalised correlation — the first such peak is the fundamental, not an octave below. */
const CLARITY_REL = 0.85;
/** Below this normalised correlation there is no pitch worth playing (noise, a drum, silence). */
const MIN_CLARITY = 0.55;

/**
 * The note that sounds at `startSec` of a stem, as a MIDI number (fractional), or null when nothing
 * tonal is there. McLeod-style normalised autocorrelation on one short window: the first lag whose
 * correlation comes close to the best one is the period, refined by parabolic interpolation.
 * Offline tooling only (the chart carries the result); no allocation concerns.
 */
export function detectPitch(samples: Float32Array, sampleRate: number, startSec: number): number | null {
  const n = Math.floor(WINDOW_SEC * sampleRate);
  const from = Math.max(0, Math.floor(startSec * sampleRate));
  if (from + n > samples.length) return null;
  const x = samples.subarray(from, from + n);
  let energy = 0;
  for (let i = 0; i < n; i++) energy += x[i] * x[i];
  if (energy / n < 1e-6) return null;
  const minLag = Math.floor(sampleRate / F_MAX);
  const maxLag = Math.min(n - 2, Math.ceil(sampleRate / F_MIN));
  // Normalised square difference (NSDF): 2·r(τ) / (m(τ)), in −1..1, 1 = perfect periodicity.
  const nsdf = new Float32Array(maxLag + 1);
  for (let tau = 1; tau <= maxLag; tau++) {
    let acf = 0;
    let m = 0;
    for (let i = 0; i + tau < n; i++) {
      acf += x[i] * x[i + tau];
      m += x[i] * x[i] + x[i + tau] * x[i + tau];
    }
    nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
  }
  // Key maxima: the highest point of every positive run between zero crossings — after the lag-0 lobe,
  // whose tail is not a period (McLeod: start past the first negative-going zero crossing).
  const peaks: number[] = [];
  let tau = 1;
  while (tau <= maxLag && nsdf[tau] > 0) tau++;
  tau = Math.max(tau, minLag);
  while (tau <= maxLag) {
    if (nsdf[tau] <= 0) {
      tau++;
      continue;
    }
    let best = tau;
    while (tau <= maxLag && nsdf[tau] > 0) {
      if (nsdf[tau] > nsdf[best]) best = tau;
      tau++;
    }
    peaks.push(best);
  }
  if (!peaks.length) return null;
  let top = 0;
  for (const p of peaks) top = Math.max(top, nsdf[p]);
  if (top < MIN_CLARITY) return null;
  const chosen = peaks.find((p) => nsdf[p] >= CLARITY_REL * top)!;
  // Parabolic interpolation around the chosen lag.
  const a = nsdf[chosen - 1] ?? nsdf[chosen];
  const b = nsdf[chosen];
  const c = nsdf[chosen + 1] ?? nsdf[chosen];
  const denom = a - 2 * b + c;
  const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
  const period = chosen + Math.max(-1, Math.min(1, shift));
  const hz = sampleRate / period;
  if (hz < F_MIN || hz > F_MAX) return null;
  return 69 + 12 * Math.log2(hz / 440);
}

/** MIDI number → frequency in Hz. */
export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}
