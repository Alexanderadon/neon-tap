/**
 * Procedural renderer of the NEON TAP mark into an RGBA buffer — the same picture as
 * `public/icons/icon.svg` (four neon lanes with a glow and the white hit line on a dark rounded
 * square) so the PNG and SVG icons match. Tiny software rasterizer: analytic anti-aliasing from
 * signed-distance rounded rectangles, separable box blur for the glow, straight-alpha "over".
 */

export type Rgb = readonly [number, number, number];

export const ICON_BG: Rgb = [0x05, 0x06, 0x0a];
export const LANE_COLORS: readonly Rgb[] = [
  [0x00, 0xf0, 0xff], // cyan
  [0xff, 0x2b, 0xd6], // magenta
  [0xb6, 0xff, 0x00], // lime
  [0xff, 0x8a, 0x00], // orange
];

/** Geometry in the 512-unit design space of `icon.svg`. */
const DESIGN = 512;
const CORNER = 96;
const BAR_W = 76;
const BAR_H = 276;
const BAR_R = 22;
const BAR_Y = 118;
const BAR_X0 = 72;
const BAR_STEP = 98;
const GLOW_SIGMA = 14;
const GLOW_ALPHA = 0.75;
const LINE = { x: 56, y: 330, w: 400, h: 6, r: 3, alpha: 0.85 };
/** Maskable icons: the mark stays inside the 80 % safe circle with a margin. */
export const MASKABLE_SCALE = 0.66;

export interface IconOptions {
  /** Full-bleed background, mark shrunk into the safe zone (Android adaptive icons). */
  maskable?: boolean;
  /** Full-bleed background without shrinking (apple-touch-icon: iOS rounds it itself). */
  opaque?: boolean;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Coverage mask (0..1 per pixel) of a rounded rectangle given in pixel units. */
export function roundedRectMask(w: number, h: number, x: number, y: number, rw: number, rh: number, r: number): Float32Array {
  const mask = new Float32Array(w * h);
  const cx = x + rw / 2;
  const cy = y + rh / 2;
  const hw = rw / 2;
  const hh = rh / 2;
  const rr = Math.min(r, hw, hh);
  const x0 = Math.max(0, Math.floor(x - 1));
  const x1 = Math.min(w, Math.ceil(x + rw + 1));
  const y0 = Math.max(0, Math.floor(y - 1));
  const y1 = Math.min(h, Math.ceil(y + rh + 1));
  for (let py = y0; py < y1; py++) {
    const qy = Math.abs(py + 0.5 - cy) - (hh - rr);
    for (let px = x0; px < x1; px++) {
      const qx = Math.abs(px + 0.5 - cx) - (hw - rr);
      const ox = qx > 0 ? qx : 0;
      const oy = qy > 0 ? qy : 0;
      const d = Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - rr;
      mask[py * w + px] = clamp01(0.5 - d);
    }
  }
  return mask;
}

function boxBlur1D(src: Float32Array, dst: Float32Array, w: number, h: number, r: number, horizontal: boolean): void {
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const norm = 1 / (2 * r + 1);
  for (let l = 0; l < lines; l++) {
    const base = horizontal ? l * w : l;
    const step = horizontal ? 1 : w;
    let sum = 0;
    for (let i = -r; i <= r; i++) if (i >= 0 && i < len) sum += src[base + i * step];
    for (let i = 0; i < len; i++) {
      dst[base + i * step] = sum * norm;
      const add = i + r + 1;
      const sub = i - r;
      if (add < len) sum += src[base + add * step];
      if (sub >= 0) sum -= src[base + sub * step];
    }
  }
}

/** Three box-blur passes ≈ Gaussian with σ ≈ radius. Outside the image counts as 0. */
export function blurMask(mask: Float32Array, w: number, h: number, radius: number, passes = 3): Float32Array {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) return Float32Array.from(mask);
  let a = Float32Array.from(mask);
  let b = new Float32Array(mask.length);
  for (let p = 0; p < passes; p++) {
    boxBlur1D(a, b, w, h, r, true);
    boxBlur1D(b, a, w, h, r, false);
  }
  void b;
  return a;
}

/** Straight-alpha float canvas with "source over" fills through a coverage mask. */
export class Raster {
  readonly data: Float32Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Float32Array(w * h * 4);
  }

  fill(mask: Float32Array, color: Rgb, opacity = 1): void {
    const d = this.data;
    const sr = color[0] / 255;
    const sg = color[1] / 255;
    const sb = color[2] / 255;
    for (let i = 0; i < mask.length; i++) {
      const sa = clamp01(mask[i] * opacity);
      if (sa <= 0) continue;
      const o = i * 4;
      const da = d[o + 3];
      const oa = sa + da * (1 - sa);
      if (oa <= 0) continue;
      const k = (da * (1 - sa)) / oa;
      const s = sa / oa;
      d[o] = sr * s + d[o] * k;
      d[o + 1] = sg * s + d[o + 1] * k;
      d[o + 2] = sb * s + d[o + 2] * k;
      d[o + 3] = oa;
    }
  }

  toRgba(): Uint8Array {
    const out = new Uint8Array(this.data.length);
    for (let i = 0; i < this.data.length; i++) out[i] = Math.round(clamp01(this.data[i]) * 255);
    return out;
  }
}

/** Render the mark at `size`×`size` pixels; returns straight-alpha RGBA. */
export function renderIcon(size: number, opts: IconOptions = {}): Uint8Array {
  if (!Number.isInteger(size) || size < 8) throw new Error(`icon: bad size ${size}`);
  const s = size / DESIGN;
  const k = opts.maskable ? MASKABLE_SCALE : 1;
  const c = DESIGN / 2;
  // Design → pixel: shrink around the centre (maskable), then scale to the target size.
  const X = (v: number) => (c + (v - c) * k) * s;
  const L = (v: number) => v * k * s;
  const raster = new Raster(size, size);
  const full = new Float32Array(size * size).fill(1);

  if (opts.maskable || opts.opaque) raster.fill(full, ICON_BG);
  else raster.fill(roundedRectMask(size, size, 0, 0, size, size, CORNER * s), ICON_BG);

  LANE_COLORS.forEach((color, i) => {
    const bar = roundedRectMask(size, size, X(BAR_X0 + BAR_STEP * i), X(BAR_Y), L(BAR_W), L(BAR_H), L(BAR_R));
    raster.fill(blurMask(bar, size, size, L(GLOW_SIGMA)), color, GLOW_ALPHA);
    raster.fill(bar, color);
  });
  raster.fill(roundedRectMask(size, size, X(LINE.x), X(LINE.y), L(LINE.w), L(LINE.h), L(LINE.r)), [255, 255, 255], LINE.alpha);
  return raster.toRgba();
}
