import { describe, expect, it } from 'vitest';
import { blurMask, ICON_BG, LANE_COLORS, MASKABLE_SCALE, renderIcon, roundedRectMask } from './icon-render';

const px = (rgba: Uint8Array, size: number, x: number, y: number) => [...rgba.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)];
const near = (a: number[], b: readonly number[], tol: number) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

describe('roundedRectMask', () => {
  it('is 1 inside, 0 outside, fractional on the edge', () => {
    const m = roundedRectMask(16, 16, 4, 4, 8, 8, 2);
    expect(m[8 * 16 + 8]).toBe(1);
    expect(m[0]).toBe(0);
    expect(m[4 * 16 + 4]).toBeLessThan(1); // corner pixel, rounded away
    expect(m[4 * 16 + 4]).toBeGreaterThanOrEqual(0);
    expect(m[8 * 16 + 3]).toBe(0); // the edge sits on the pixel boundary: pixel 3 is fully outside
    // An edge through the middle of a pixel gives half coverage (analytic anti-aliasing).
    const half = roundedRectMask(16, 16, 3.5, 4, 8, 8, 2);
    expect(half[8 * 16 + 3]).toBeCloseTo(0.5, 5);
  });
});

describe('blurMask', () => {
  it('preserves the total coverage and spreads it', () => {
    const w = 32;
    const m = new Float32Array(w * w);
    m[16 * w + 16] = 1;
    const b = blurMask(m, w, w, 3);
    const sum = b.reduce((n, v) => n + v, 0);
    expect(sum).toBeCloseTo(1, 3);
    expect(b[16 * w + 16]).toBeLessThan(0.1);
    expect(b[16 * w + 19]).toBeGreaterThan(0);
  });
});

describe('renderIcon', () => {
  const size = 128;
  const icon = renderIcon(size);
  const at = (x512: number, y512: number) => px(icon, size, Math.floor((x512 / 512) * size), Math.floor((y512 / 512) * size));

  it('returns a full RGBA buffer', () => {
    expect(icon.length).toBe(size * size * 4);
  });

  it('has transparent rounded corners and an opaque dark centre gap', () => {
    expect(px(icon, size, 0, 0)[3]).toBe(0);
    expect(px(icon, size, size - 1, size - 1)[3]).toBe(0);
    const gap = at(257, 200); // between the magenta and lime bars: background tinted by glow only
    expect(gap[3]).toBe(255);
    expect(gap[0] + gap[1] + gap[2]).toBeLessThan(3 * 90);
  });

  it('paints the four lanes in their colours and the white hit line', () => {
    LANE_COLORS.forEach((c, i) => {
      const p = at(72 + 98 * i + 38, 220);
      expect(near(p, [...c, 255], 6)).toBe(true);
    });
    const line = at(256, 333);
    expect(line[0]).toBeGreaterThan(200);
    expect(line[1]).toBeGreaterThan(200);
    expect(line[2]).toBeGreaterThan(200);
  });

  it('maskable / opaque variants are full-bleed and the maskable mark is shrunk', () => {
    const mask = renderIcon(size, { maskable: true });
    const opaque = renderIcon(size, { opaque: true });
    expect(near(px(mask, size, 0, 0), [...ICON_BG, 255], 2)).toBe(true);
    expect(near(px(opaque, size, 0, 0), [...ICON_BG, 255], 2)).toBe(true);
    // Where the unscaled cyan bar would be, the maskable icon shows background.
    const cyanX = 72 + 38;
    const shrunkX = 256 + (cyanX - 256) * MASKABLE_SCALE;
    const outside = px(mask, size, Math.floor((cyanX / 512) * size), Math.floor((256 / 512) * size));
    expect(outside[0] + outside[1] + outside[2]).toBeLessThan(3 * 90);
    const inside = px(mask, size, Math.floor((shrunkX / 512) * size), Math.floor((256 / 512) * size));
    expect(near(inside, [...LANE_COLORS[0], 255], 6)).toBe(true);
  });

  it('rejects silly sizes', () => {
    expect(() => renderIcon(4)).toThrow(/size/);
  });
});
