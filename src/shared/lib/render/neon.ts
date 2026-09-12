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

/**
 * Equaliser / skyline bar: a vertical glow that is solid at the bottom and fades to nothing at
 * the top, with a bright cap. Drawn stretched to the band's height every frame (no gradients
 * or blur per frame — one drawImage per band).
 */
export function renderGlowBar(color: string, width: number, height: number, dpr: number): NoteSprite {
  const w = Math.ceil(width * dpr);
  const h = Math.ceil(height * dpr);
  const canvas = makeCanvas(w, h);
  const ctx = ctx2d(canvas);
  ctx.scale(dpr, dpr);
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.08, color);
  g.addColorStop(0.55, hexToRgba(color, 0.35));
  g.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = g;
  const inset = width * 0.12;
  roundRect(ctx, inset, 0, width - inset * 2, height, Math.min(4, width / 4));
  ctx.fill();
  return { canvas, pad: 0, width, height };
}

/** Soft glowing ring (beat pulse, concentric ambient rings). Scale it with drawImage; never stroke + blur per frame. */
export function renderGlowRing(color: string, radius: number, dpr: number): NoteSprite {
  const pad = Math.max(6, radius * 0.35);
  const total = (radius + pad) * 2;
  const canvas = makeCanvas(Math.ceil(total * dpr), Math.ceil(total * dpr));
  const ctx = ctx2d(canvas);
  ctx.scale(dpr, dpr);
  const c = total / 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = pad;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, radius * 0.06);
  ctx.beginPath();
  ctx.arc(c, c, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = Math.max(1, radius * 0.02);
  ctx.beginPath();
  ctx.arc(c, c, radius, 0, Math.PI * 2);
  ctx.stroke();
  return { canvas, pad, width: total, height: total };
}

function heartPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  // s = half width
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.95);
  ctx.bezierCurveTo(cx - s * 1.6, cy - s * 0.1, cx - s * 0.9, cy - s * 1.15, cx, cy - s * 0.45);
  ctx.bezierCurveTo(cx + s * 0.9, cy - s * 1.15, cx + s * 1.6, cy - s * 0.1, cx, cy + s * 0.95);
  ctx.closePath();
}

function hourglassPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  // s = half height
  const w = s * 0.75;
  ctx.beginPath();
  ctx.moveTo(cx - w, cy - s);
  ctx.lineTo(cx + w, cy - s);
  ctx.lineTo(cx + w * 0.15, cy);
  ctx.lineTo(cx + w, cy + s);
  ctx.lineTo(cx - w, cy + s);
  ctx.lineTo(cx - w * 0.15, cy);
  ctx.closePath();
}

/** Neon heart for the HUD (filled = life, hollow = lost). */
export function renderHeart(color: string, size: number, dpr: number, filled: boolean): NoteSprite {
  const pad = Math.round(size * 0.6);
  const total = size + pad * 2;
  const canvas = makeCanvas(Math.ceil(total * dpr), Math.ceil(total * dpr));
  const ctx = ctx2d(canvas);
  ctx.scale(dpr, dpr);
  const c = total / 2;
  heartPath(ctx, c, c + size * 0.05, size * 0.42);
  ctx.lineWidth = Math.max(1.5, size * 0.09);
  if (filled) {
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.6;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.stroke();
  }
  return { canvas, pad, width: total, height: total };
}

/**
 * Spell note: glowing ring with an icon inside — hourglass for "slow", heart for "+life".
 * Hand-drawn vector paths so the style matches the rest of the neon UI.
 */
export function renderSpell(kind: 'slow' | 'heart', size: number, dpr: number): NoteSprite {
  const color = kind === 'slow' ? '#00f0ff' : '#ff2bd6';
  const pad = Math.round(size * 0.5);
  const total = size + pad * 2;
  const canvas = makeCanvas(Math.ceil(total * dpr), Math.ceil(total * dpr));
  const ctx = ctx2d(canvas);
  ctx.scale(dpr, dpr);
  const c = total / 2;
  const r = size / 2;

  // Outer ring with glow.
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.5;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.1);
  ctx.beginPath();
  ctx.arc(c, c, r - ctx.lineWidth, 0, Math.PI * 2);
  ctx.stroke();
  ctx.stroke();
  // Dark disc so the icon reads on top of the lane.
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(5,6,10,0.85)';
  ctx.beginPath();
  ctx.arc(c, c, r - ctx.lineWidth * 1.6, 0, Math.PI * 2);
  ctx.fill();

  // Icon.
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.35;
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.07);
  ctx.lineJoin = 'round';
  if (kind === 'slow') {
    hourglassPath(ctx, c, c, r * 0.5);
    ctx.fill();
    ctx.stroke();
    // Sand pile at the bottom.
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(c - r * 0.22, c + r * 0.48);
    ctx.lineTo(c + r * 0.22, c + r * 0.48);
    ctx.lineTo(c, c + r * 0.2);
    ctx.closePath();
    ctx.fill();
  } else {
    heartPath(ctx, c, c + r * 0.06, r * 0.42);
    ctx.fill();
    ctx.stroke();
  }
  return { canvas, pad, width: total, height: total };
}

/** Crystal outline: an elongated hexagon (gem cut), `s` = half height, width ≈ 0.62 of the height. */
function crystalPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  const w = s * 0.62;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx + w, cy - s * 0.42);
  ctx.lineTo(cx + w, cy + s * 0.42);
  ctx.lineTo(cx, cy + s);
  ctx.lineTo(cx - w, cy + s * 0.42);
  ctx.lineTo(cx - w, cy - s * 0.42);
  ctx.closePath();
}

/**
 * Collectible crystal (gem note): glowing faceted hexagon with a bright core. `size` is the
 * crystal height in CSS px; the big variant gets a second, warmer facet ring. Drawn rotated
 * with `drawImage` every frame — nothing here runs in the loop.
 */
export function renderCrystal(color: string, size: number, dpr: number, big = false): NoteSprite {
  const pad = Math.round(size * 0.55);
  const total = size + pad * 2;
  const canvas = makeCanvas(Math.ceil(total * dpr), Math.ceil(total * dpr));
  const ctx = ctx2d(canvas);
  ctx.scale(dpr, dpr);
  const c = total / 2;
  const s = size / 2;
  ctx.lineJoin = 'round';

  // Glow + body.
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.45;
  ctx.fillStyle = color;
  crystalPath(ctx, c, c, s);
  ctx.fill();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Facets: a darker left half and a lighter right half read as depth.
  ctx.save();
  crystalPath(ctx, c, c, s);
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(c - size, c - size, size, size * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.moveTo(c, c - s);
  ctx.lineTo(c + s * 0.62, c - s * 0.42);
  ctx.lineTo(c, c + s * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Inner core: white heart of the gem.
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = size * 0.25;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  crystalPath(ctx, c, c, s * 0.42);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Outline (+ a second warm ring on the big gem).
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = Math.max(1.5, size * 0.06);
  crystalPath(ctx, c, c, s);
  ctx.stroke();
  if (big) {
    ctx.strokeStyle = '#ffd700';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = size * 0.3;
    ctx.lineWidth = Math.max(1.5, size * 0.05);
    crystalPath(ctx, c, c, s + pad * 0.35);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  return { canvas, pad, width: total, height: total };
}

export function hexToRgba(hex: string, alpha: number): string {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${alpha})`;
}
