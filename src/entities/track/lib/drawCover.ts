import type { CoverSpec } from '../model/cover';

/** The slice of CanvasRenderingContext2D the cover painter uses — small enough to fake in tests. */
export interface CoverContext {
  save(): void;
  restore(): void;
  scale(x: number, y: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): { addColorStop(offset: number, color: string): void };
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  rect(x: number, y: number, w: number, h: number): void;
  roundRect?(x: number, y: number, w: number, h: number, radii: number): void;
  arc(x: number, y: number, r: number, start: number, end: number): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  fill(path?: Path2D): void;
  stroke(path?: Path2D): void;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineJoin: CanvasLineJoin;
  lineCap: CanvasLineCap;
  globalAlpha: number;
}

const num = (v: number | string): number => (typeof v === 'number' ? v : parseFloat(v) || 0);

/**
 * Paint a procedural cover (the same primitives `TrackCover` renders as SVG) onto a canvas of
 * `size` px. The 100 × 100 viewBox is scaled, so a 24 px canvas costs a few dozen draw calls —
 * CoverScene then upscales it to the screen for a free blur (no CSS filter).
 */
export function drawCover(ctx: CoverContext, spec: CoverSpec, size: number, makePath: (d: string) => Path2D | null = defaultPath): void {
  ctx.save();
  ctx.scale(size / 100, size / 100);
  const bg = ctx.createLinearGradient(0, 0, 0, 100);
  bg.addColorStop(0, spec.palette.bg[0]);
  bg.addColorStop(1, spec.palette.bg[1]);
  ctx.fillStyle = bg as unknown as CanvasGradient;
  ctx.fillRect(0, 0, 100, 100);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const s of spec.shapes) {
    ctx.globalAlpha = s.opacity ?? 1;
    switch (s.kind) {
      case 'rect': {
        ctx.fillStyle = s.fill;
        ctx.beginPath();
        if (s.rx && ctx.roundRect) ctx.roundRect(num(s.x), num(s.y), num(s.w), num(s.h), s.rx);
        else ctx.rect(num(s.x), num(s.y), num(s.w), num(s.h));
        ctx.fill();
        break;
      }
      case 'circle': {
        ctx.beginPath();
        ctx.arc(num(s.cx), num(s.cy), num(s.r), 0, Math.PI * 2);
        if (s.fill && s.fill !== 'none') {
          ctx.fillStyle = s.fill;
          ctx.fill();
        }
        if (s.stroke && s.strokeWidth) {
          ctx.strokeStyle = s.stroke;
          ctx.lineWidth = s.strokeWidth;
          ctx.stroke();
        }
        break;
      }
      case 'line': {
        ctx.beginPath();
        ctx.moveTo(num(s.x1), num(s.y1));
        ctx.lineTo(num(s.x2), num(s.y2));
        ctx.strokeStyle = s.stroke;
        ctx.lineWidth = s.strokeWidth;
        ctx.stroke();
        break;
      }
      case 'path': {
        const p = makePath(s.d);
        if (!p) break;
        if (s.fill && s.fill !== 'none') {
          ctx.fillStyle = s.fill;
          ctx.fill(p);
        }
        if (s.stroke && s.strokeWidth) {
          ctx.strokeStyle = s.stroke;
          ctx.lineWidth = s.strokeWidth;
          ctx.stroke(p);
        }
        break;
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function defaultPath(d: string): Path2D | null {
  return typeof Path2D === 'undefined' ? null : new Path2D(d);
}
