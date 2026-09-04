/**
 * Iterative radix-2 FFT for real-valued frames. No dependencies, allocation-free after construction.
 * Used both in the Web Worker (custom songs) and in Node (built-in chart generation script).
 */
export class RealFFT {
  private readonly cos: Float32Array;
  private readonly sin: Float32Array;
  private readonly rev: Uint32Array;
  private readonly re: Float32Array;
  private readonly im: Float32Array;
  readonly window: Float32Array;

  constructor(readonly size: number) {
    if ((size & (size - 1)) !== 0) throw new Error('FFT size must be a power of two');
    this.cos = new Float32Array(size / 2);
    this.sin = new Float32Array(size / 2);
    for (let i = 0; i < size / 2; i++) {
      this.cos[i] = Math.cos((-2 * Math.PI * i) / size);
      this.sin[i] = Math.sin((-2 * Math.PI * i) / size);
    }
    this.rev = new Uint32Array(size);
    const bits = Math.log2(size);
    for (let i = 0; i < size; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.re = new Float32Array(size);
    this.im = new Float32Array(size);
    this.window = new Float32Array(size);
    for (let i = 0; i < size; i++) this.window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)); // Hann
  }

  /**
   * Compute magnitude spectrum of `input` (length = size) into `out` (length = size/2 + 1).
   * Applies a Hann window.
   */
  magnitudes(input: Float32Array, out: Float32Array): void {
    const n = this.size;
    const { re, im, rev, cos, sin, window } = this;
    for (let i = 0; i < n; i++) {
      re[rev[i]] = input[i] * window[i];
      im[rev[i]] = 0;
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const step = n / len;
      for (let i = 0; i < n; i += len) {
        for (let j = 0; j < half; j++) {
          const k = j * step;
          const a = i + j;
          const b = a + half;
          const tr = re[b] * cos[k] - im[b] * sin[k];
          const ti = re[b] * sin[k] + im[b] * cos[k];
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
    const bins = (n >> 1) + 1;
    for (let k = 0; k < bins; k++) out[k] = Math.hypot(re[k], im[k]);
  }
}
