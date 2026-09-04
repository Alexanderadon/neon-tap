/** Test helper: a synthetic "drum track" — decaying noise bursts at known times over a quiet pad. */
export function synthesizeClicks(
  times: readonly number[],
  durationSec: number,
  sampleRate = 22050,
  seed = 42,
): Float32Array {
  const out = new Float32Array(Math.ceil(durationSec * sampleRate));
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296 - 0.5;
  };
  // Quiet sustained pad so the signal is never perfectly silent.
  for (let i = 0; i < out.length; i++) out[i] = 0.02 * Math.sin((2 * Math.PI * 110 * i) / sampleRate);
  const burst = Math.floor(sampleRate * 0.03);
  for (const t of times) {
    const start = Math.floor(t * sampleRate);
    for (let i = 0; i < burst && start + i < out.length; i++) {
      const env = Math.exp(-i / (burst / 4));
      out[start + i] += rand() * env * 1.6;
    }
  }
  return out;
}
