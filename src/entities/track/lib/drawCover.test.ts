import { describe, expect, it } from 'vitest';
import { GENRES } from '@/shared/types/chart';
import { coverSpec } from '../model/cover';
import { drawCover, type CoverContext } from './drawCover';

/** Records every call so the painter can be checked without a real canvas. */
function fakeContext() {
  const calls: string[] = [];
  const ctx: CoverContext = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineJoin: 'miter',
    lineCap: 'butt',
    globalAlpha: 1,
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    scale: (x, y) => calls.push(`scale ${x} ${y}`),
    createLinearGradient: () => ({ addColorStop: (o, c) => calls.push(`stop ${o} ${c}`) }),
    fillRect: (x, y, w, h) => calls.push(`fillRect ${x} ${y} ${w} ${h}`),
    beginPath: () => calls.push('beginPath'),
    rect: () => calls.push('rect'),
    roundRect: () => calls.push('roundRect'),
    arc: () => calls.push('arc'),
    moveTo: () => calls.push('moveTo'),
    lineTo: () => calls.push('lineTo'),
    fill: (p) => calls.push(p ? 'fillPath' : 'fill'),
    stroke: (p) => calls.push(p ? 'strokePath' : 'stroke'),
  };
  return { ctx, calls };
}

const pathStub = (d: string) => ({ d } as unknown as Path2D);

describe('drawCover', () => {
  it('scales the 100-box to the canvas size and paints the genre gradient first', () => {
    const { ctx, calls } = fakeContext();
    const spec = coverSpec('metal-song', 'rock');
    drawCover(ctx, spec, 24, pathStub);
    expect(calls.slice(0, 5)).toEqual(['save', 'scale 0.24 0.24', 'stop 0 #1a0a0a', 'stop 1 #3a1010', 'fillRect 0 0 100 100']);
    expect(calls[calls.length - 1]).toBe('restore');
    expect(ctx.globalAlpha).toBe(1);
  });

  it('draws every shape of every genre (no primitive is skipped)', () => {
    for (const g of GENRES) {
      const { ctx, calls } = fakeContext();
      const spec = coverSpec('t', g);
      drawCover(ctx, spec, 24, pathStub);
      const drawn = calls.filter((c) => c === 'fill' || c === 'stroke' || c === 'fillPath' || c === 'strokePath').length;
      expect(drawn).toBeGreaterThanOrEqual(spec.shapes.length);
    }
  });

  it('skips paths when Path2D is unavailable instead of throwing', () => {
    const { ctx } = fakeContext();
    expect(() => drawCover(ctx, coverSpec('t', 'rock'), 24, () => null)).not.toThrow();
  });
});
