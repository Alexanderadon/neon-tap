/**
 * Log-spaced spectrum bands for the audio-reactive background. Pure math over the raw
 * `AnalyserNode` bins so it can be unit-tested; the band edges are computed once per
 * (bin count, band count) pair and reused — nothing is allocated per frame.
 */
export const SPECTRUM_BANDS = 32;

/** Lowest bin that contributes (bin 0 is DC / sub-bass rumble that never moves). */
const FIRST_BIN = 1;

export interface BandLayout {
  bins: number;
  bands: number;
  /** `edges[i]..edges[i+1]` (exclusive) are the bins of band `i`; length = bands + 1. */
  edges: Int32Array;
}

/**
 * Bin ranges for `bands` log-spaced bands over `bins` FFT bins. Every band covers at least one
 * bin, bands never overlap, and together they span `FIRST_BIN..bins`.
 */
export function bandLayout(bins: number, bands: number = SPECTRUM_BANDS): BandLayout {
  const edges = new Int32Array(bands + 1);
  const lo = FIRST_BIN;
  const hi = Math.max(lo + bands, bins);
  const ratio = hi / lo;
  edges[0] = lo;
  for (let i = 1; i <= bands; i++) {
    const ideal = Math.round(lo * Math.pow(ratio, i / bands));
    // Monotone and at least one bin wide; leave room for the bands still to come.
    const minEdge = edges[i - 1] + 1;
    const maxEdge = hi - (bands - i);
    edges[i] = Math.min(maxEdge, Math.max(minEdge, ideal));
  }
  edges[bands] = hi;
  return { bins, bands, edges };
}

/** Last layout used; the analyser size never changes at runtime, so this is a hit every frame (no string keys, no allocations). */
let cached: BandLayout | null = null;

function layoutFor(bins: number, bands: number): BandLayout {
  if (!cached || cached.bins !== bins || cached.bands !== bands) cached = bandLayout(bins, bands);
  return cached;
}

/**
 * Fold raw byte-frequency bins into `out.length` log-spaced bands (0..255, mean of the bins in
 * the band). Bins past the end of `raw` count as silence, so a short analyser never throws.
 */
export function spectrumBands(raw: ArrayLike<number>, out: Uint8Array): void {
  const bands = out.length;
  if (bands === 0) return;
  const L = layoutFor(raw.length, bands);
  const e = L.edges;
  for (let i = 0; i < bands; i++) {
    const from = e[i];
    const to = e[i + 1];
    let sum = 0;
    let n = 0;
    for (let b = from; b < to; b++) {
      sum += b < raw.length ? raw[b] : 0;
      n++;
    }
    out[i] = n > 0 ? (sum / n) | 0 : 0;
  }
}
