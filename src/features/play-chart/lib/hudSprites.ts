/**
 * HUD chrome sprites for the in-game canvas (package D, screens-game.html): the same materials as
 * the DOM design system — glossy 3D hearts and stars with SVG-style gradients and radial halos,
 * 32 px chips and 24 px tags with a face and an underside, and the «--emboss» text of the verdict
 * (outline + underside + soft gold glow, built from strokes: no shadowBlur, no filters).
 * Everything here is pre-rendered once (per resize) and blitted per frame.
 */
import type { NoteSprite } from '@/shared/lib/render';
import { detailFor, drawCrown, drawStar } from '@/shared/lib/render';

export const HUD_FONT = "'Unbounded', 'Arial Black', 'Segoe UI', system-ui, sans-serif";

/** Design tokens (spec §1.1) — the canvas cannot read CSS variables per frame, so they live here too. */
export const HUD = {
  bg: '#05060a',
  panel: '#0b0d16',
  cyan: '#00f0ff',
  gold: '#ffd700',
  mag: '#ff2bd6',
  goldRim: '#8a4500',
  goldUnder: '#7a3a00',
  magUnder: '#5a0a48',
  w80: 'rgba(255,255,255,0.8)',
  w55: 'rgba(255,255,255,0.55)',
  w30: 'rgba(255,255,255,0.3)',
  w10: 'rgba(255,255,255,0.1)',
  glowGold: 'rgba(255,200,0,0.6)',
  glowMag: 'rgba(255,43,214,0.6)',
  glowCyan: 'rgba(0,240,255,0.8)',
} as const;

/** Column: 335 px in 20 px gutters, centred (spec §1.4). */
export const COL_W = 335;
export const GUTTER = 20;

const HEART_PATH = 'M12 21.2 4.6 14A5.2 5.2 0 0 1 12 6.6a5.2 5.2 0 0 1 7.4 7.4Z';
const HEART_SHINE = 'M7.2 9.6a2.6 2.6 0 0 1 3-1.6';
const CRYSTAL_PATH = 'M12 2 20 9 12 22 4 9Z';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** A square sprite `size` px with `pad` px of room around it for halos; `draw` works in a 24 × 24 box. */
function glyph(size: number, pad: number, dpr: number, draw: (ctx: Ctx) => void): NoteSprite {
  const total = size + pad * 2;
  const canvas = makeCanvas(Math.ceil(total * dpr), Math.ceil(total * dpr));
  const ctx = canvas.getContext('2d') as Ctx;
  ctx.scale(dpr, dpr);
  ctx.translate(pad, pad);
  ctx.scale(size / 24, size / 24);
  ctx.lineJoin = 'round';
  draw(ctx);
  return { canvas, pad, width: total, height: total };
}

function vertical(ctx: Ctx, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(0, 0, 0, 24);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** The three faces of spec §1.1: gold, off (dark grey), white glossy. */
function face(ctx: Ctx, kind: 'gold' | 'off' | 'white'): CanvasGradient {
  if (kind === 'gold')
    return vertical(ctx, [
      [0, '#fff3a0'],
      [0.45, '#ffd23f'],
      [1, '#ff8a00'],
    ]);
  if (kind === 'white')
    return vertical(ctx, [
      [0, '#ffffff'],
      [0.45, '#cfd3e0'],
      [1, '#8a8fa3'],
    ]);
  return vertical(ctx, [
    [0, '#3a3d4c'],
    [0.45, '#23252f'],
    [1, '#15161d'],
  ]);
}

/** Radial halo inside the sprite (the `gHalo` / `gHaloCy` gradients of the mock). */
function halo(ctx: Ctx, cx: number, cy: number, r: number, color: 'gold' | 'cyan'): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  if (color === 'gold') {
    g.addColorStop(0, 'rgba(255,215,0,0.5)');
    g.addColorStop(0.6, 'rgba(255,215,0,0.12)');
    g.addColorStop(1, 'rgba(255,215,0,0)');
  } else {
    g.addColorStop(0, 'rgba(0,240,255,0.45)');
    g.addColorStop(1, 'rgba(0,240,255,0)');
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

export type HeartKind = 'on' | 'off' | 'gold';

/** Heart 20 (HUD) / 40 (revive panel): white glossy, off, or gilded with a halo — a life past five gilds a shown heart. */
export function heartSprite(kind: HeartKind, size: number, dpr: number): NoteSprite {
  return glyph(size, Math.round(size * 0.6), dpr, (ctx) => {
    if (kind === 'gold') halo(ctx, 12, 13, 13, 'gold');
    const body = new Path2D(HEART_PATH);
    ctx.fillStyle = face(ctx, kind === 'on' ? 'white' : kind === 'gold' ? 'gold' : 'off');
    ctx.fill(body);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = kind === 'gold' ? HUD.goldRim : 'rgba(0,0,0,0.6)';
    ctx.stroke(body);
    ctx.strokeStyle = kind === 'off' ? 'rgba(255,255,255,0.08)' : kind === 'gold' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.stroke(new Path2D(HEART_SHINE));
  });
}

/** Level star 20 (HUD) / 120 (star show): the gem-cut gold star of shared/ui/Stars, or the dark one; `withHalo` adds the radial glow. */
export function starSprite(on: boolean, size: number, dpr: number, withHalo = false): NoteSprite {
  return glyph(size, Math.round(size * 0.5), dpr, (ctx) => {
    if (withHalo) halo(ctx, 12, 12.5, 17, 'gold');
    drawStar(ctx, on, detailFor(size));
  });
}

/** The endless mode's crown, the star's sibling in every size. */
export function crownSprite(on: boolean, size: number, dpr: number, withHalo = false): NoteSprite {
  return glyph(size, Math.round(size * 0.5), dpr, (ctx) => {
    if (withHalo) halo(ctx, 12, 12.5, 17, 'gold');
    drawCrown(ctx, on, detailFor(size));
  });
}

/** Crystal 16 with the cyan halo (the wallet glyph of the top bar). */
export function crystalSprite(size: number, dpr: number): NoteSprite {
  return glyph(size, Math.round(size * 0.9), dpr, (ctx) => {
    halo(ctx, 12, 12, 13, 'cyan');
    ctx.fillStyle = HUD.cyan;
    ctx.fill(new Path2D(CRYSTAL_PATH));
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill(new Path2D('M12 2 20 9 12 22Z'));
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill(new Path2D('M4 9h16l-8 13Z'));
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.2;
    ctx.stroke(new Path2D('M8 9 12 2l4 7'));
  });
}

function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | [number, number, number, number]): void {
  const [tl, tr, br, bl] = typeof r === 'number' ? [r, r, r, r] : r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.arcTo(x + w, y, x + w, y + h, tr);
  ctx.arcTo(x + w, y + h, x, y + h, br);
  ctx.arcTo(x, y + h, x, y, bl);
  ctx.arcTo(x, y, x + w, y, tl);
  ctx.closePath();
}

/** The dark 3D face of chips and dark tags: light from above, black underside. */
function darkObject(ctx: Ctx, w: number, h: number, r: number | [number, number, number, number], under: number): void {
  roundRectPath(ctx, 0, under, w, h, r);
  ctx.fillStyle = '#000';
  ctx.fill();
  roundRectPath(ctx, 0, 0, w, h, r);
  ctx.fillStyle = HUD.panel;
  ctx.fill();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0.1)');
  g.addColorStop(1, 'rgba(255,255,255,0.02)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.lineTo(w, 1);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = HUD.w10;
  ctx.lineWidth = 1;
  roundRectPath(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.stroke();
}

/** The gold face of tags: gold gradient, 1 px light, 2 px dark-orange underside. */
function goldObject(ctx: Ctx, w: number, h: number, r: number | [number, number, number, number], under: number): void {
  roundRectPath(ctx, 0, under, w, h, r);
  ctx.fillStyle = HUD.goldRim;
  ctx.fill();
  roundRectPath(ctx, 0, 0, w, h, r);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#fff3a0');
  g.addColorStop(0.45, '#ffd23f');
  g.addColorStop(1, '#ff8a00');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.lineTo(w, 1);
  ctx.stroke();
  ctx.restore();
}

export const CHIP_H = 32;
/** A 32 px chip face of a fixed width (score 112 / accuracy 96), 2 px underside included in the sprite height. */
export function chipSprite(width: number, dpr: number): NoteSprite {
  const h = CHIP_H + 2;
  const canvas = makeCanvas(Math.ceil(width * dpr), Math.ceil(h * dpr));
  const ctx = canvas.getContext('2d') as Ctx;
  ctx.scale(dpr, dpr);
  darkObject(ctx, width, CHIP_H, 16, 2);
  return { canvas, pad: 0, width, height: h };
}

/** Letter-spaced caps for tags (11/700, .12em) — drawn per glyph so every browser spaces alike. */
export function spacedWidth(ctx: Ctx, text: string, spacing: number): number {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  return Math.max(0, w - spacing);
}

export function drawSpaced(ctx: Ctx, text: string, cx: number, y: number, spacing: number): void {
  const w = spacedWidth(ctx, text, spacing);
  let x = cx - w / 2;
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of text) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = align;
}

export const TAG_H = 24;
export type TagKind = 'gold' | 'dark';
export type TagShape = 'pill' | 'left' | 'right';
const TAG_FONT = `700 11px ${HUD_FONT}`;
const TAG_SPACING = 11 * 0.12;

/** The 24 px label (spec §2.3) as a sprite: gold («100 КОМБО», «ПРИГОТОВЬСЯ») or dark («5 ПОЛОС · ШИРЕ»); half shapes make a pair. */
export function tagSprite(text: string, kind: TagKind, dpr: number, shape: TagShape = 'pill'): NoteSprite {
  const caps = text.toUpperCase();
  const probe = makeCanvas(1, 1).getContext('2d') as Ctx;
  probe.font = TAG_FONT;
  const textW = spacedWidth(probe, caps, TAG_SPACING);
  const w = Math.ceil(textW + 24);
  const h = TAG_H + 2;
  const canvas = makeCanvas(Math.ceil(w * dpr), Math.ceil(h * dpr));
  const ctx = canvas.getContext('2d') as Ctx;
  ctx.scale(dpr, dpr);
  const r: number | [number, number, number, number] = shape === 'pill' ? 12 : shape === 'left' ? [12, 0, 0, 12] : [0, 12, 12, 0];
  if (kind === 'gold') goldObject(ctx, w, TAG_H, r, 2);
  else darkObject(ctx, w, TAG_H, r, 2);
  ctx.font = TAG_FONT;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = kind === 'gold' ? HUD.goldUnder : HUD.w55;
  drawSpaced(ctx, caps, w / 2, TAG_H / 2 + 0.5, TAG_SPACING);
  return { canvas, pad: 0, width: w, height: h };
}

export interface EmbossStyle {
  /** Face colour (white; gold for the combo only while it burns). */
  fill: string;
  /** Outline / underside colour (#7a3a00; #5a0a48 for «ПРОВАЛ»). */
  under: string;
  /** Soft glow colour. */
  glow: string;
}

export const EMBOSS_GOLD: EmbossStyle = { fill: '#ffffff', under: HUD.goldUnder, glow: HUD.glowGold };
export const EMBOSS_COMBO_GOLD: EmbossStyle = { fill: HUD.gold, under: HUD.goldUnder, glow: HUD.glowGold };
export const EMBOSS_MAG: EmbossStyle = { fill: HUD.mag, under: HUD.magUnder, glow: HUD.glowMag };

/**
 * «--emboss» text: 1.5 px outline + 3 px underside + soft gold glow (spec §1.1), doubled for the
 * 96 px countdown. Strokes only — the glow is two wide translucent strokes, never shadowBlur.
 */
export function embossText(ctx: Ctx, text: string, x: number, y: number, size: number, style: EmbossStyle, letterSpacing = 0): void {
  const k = size >= 96 ? 2 : 1;
  ctx.font = `900 ${size}px ${HUD_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const draw = (fill: boolean, color: string, dx: number, dy: number, lw: number, alpha: number) => {
    ctx.globalAlpha = alpha * ctx.globalAlpha;
    if (fill) {
      ctx.fillStyle = color;
      if (letterSpacing) drawSpaced(ctx, text, x + dx, y + dy, letterSpacing);
      else ctx.fillText(text, x + dx, y + dy);
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      if (letterSpacing) strokeSpaced(ctx, text, x + dx, y + dy, letterSpacing);
      else ctx.strokeText(text, x + dx, y + dy);
    }
  };
  const base = ctx.globalAlpha;
  draw(false, style.glow, 0, 0, 18 * k, 0.05);
  ctx.globalAlpha = base;
  draw(false, style.glow, 0, 0, 12 * k, 0.07);
  ctx.globalAlpha = base;
  draw(false, style.glow, 0, 0, 7 * k, 0.1);
  ctx.globalAlpha = base;
  draw(false, style.under, 0, 4.5 * k, 3 * k, 1);
  ctx.globalAlpha = base;
  draw(false, style.under, 0, 3 * k, 3 * k, 1);
  ctx.globalAlpha = base;
  draw(false, style.under, 0, 0, 3 * k, 1);
  ctx.globalAlpha = base;
  draw(true, style.fill, 0, 0, 0, 1);
  ctx.globalAlpha = base;
}

function strokeSpaced(ctx: Ctx, text: string, cx: number, y: number, spacing: number): void {
  const w = spacedWidth(ctx, text, spacing);
  let x = cx - w / 2;
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of text) {
    ctx.strokeText(ch, x, y);
    x += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = align;
}

export { formatAccuracy, formatScore } from '@/shared/lib/format';

/** Overshoot pop of the design system (`cubic-bezier(.2,1.6,.4,1)` approximated): 0 → 1 with a small overshoot. */
export function popEase(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c = 1.7;
  const q = t - 1;
  return 1 + q * q * ((c + 1) * q + c);
}

/** `ease-out` (rise / fade) for 0..1. */
export function easeOut(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return 1 - (1 - u) * (1 - u);
}
