/**
 * Pre-rendered neon sprites. `shadowBlur` is expensive (3–4× FPS drop on mobile when used per
 * draw call), so every glowing shape is rasterised once here and later drawn with `drawImage`.
 */
export interface NoteSprite {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  /** Glow padding around the note body, px. */
  pad: number;
  width: number;
  height: number;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function ctx2d(c: HTMLCanvasElement | OffscreenCanvas): CanvasRenderingContext2D {
  return c.getContext('2d') as CanvasRenderingContext2D;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A glowing rounded bar — the tap note body. */
export function renderNoteSprite(color: string, width: number, height: number, dpr: number): NoteSprite {
  const pad = Math.round(height * 1.2);
  const w = Math.ceil((width + pad * 2) * dpr);
  const h = Math.ceil((height + pad * 2) * dpr);
  const canvas = makeCanvas(w, h);
  const ctx = ctx2d(canvas);
  ctx.scale(dpr, dpr);
  ctx.shadowColor = color;
  ctx.shadowBlur = height * 0.9;
  ctx.fillStyle = color;
  roundRect(ctx, pad, pad, width, height, height / 2.4);
  ctx.fill();
  ctx.fill(); // double fill = stronger glow
  ctx.shadowBlur = 0;
  const grad = ctx.createLinearGradient(0, pad, 0, pad + height);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  roundRect(ctx, pad + 2, pad + 1, width - 4, height - 2, height / 2.6);
  ctx.fill();
  return { canvas, pad, width: width + pad * 2, height: height + pad * 2 };
}

/** Soft radial glow used for hit flashes and particles. */
export function renderGlowDot(color: string, radius: number, dpr: number): NoteSprite {
  const size = Math.ceil(radius * 2 * dpr);
  const canvas = makeCanvas(size, size);
  const ctx = ctx2d(canvas);
  ctx.scale(dpr, dpr);
  const g = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, radius * 2, radius * 2);
  return { canvas, pad: radius, width: radius * 2, height: radius * 2 };
}

/** Vertical glowing beam used for the lane hit flash. */
export function renderBeam(color: string, width: number, height: number, dpr: number): NoteSprite {
  const w = Math.ceil(width * dpr);
  const h = Math.ceil(height * dpr);
  const canvas = makeCanvas(w, h);
  const ctx = ctx2d(canvas);
  ctx.scale(dpr, dpr);
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  return { canvas, pad: 0, width, height };
}

export function hexToRgba(hex: string, alpha: number): string {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${alpha})`;
}
