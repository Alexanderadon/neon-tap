import { hexToRgba } from '@/shared/lib/render';
import type { Section } from '@/entities/chart';
import type { Judgement, ResultTimeline } from '@/entities/score';
import { BG_COLOR, FONT_DISPLAY, JUDGEMENT_COLORS, laneBandColor } from './palette';

export interface StripData {
  timeline: ResultTimeline;
  sections: readonly Section[];
  /** Song length, seconds — the strip's full width. */
  duration: number;
}

/** Draw order: perfects first (most numerous, faintest), misses last so they stay on top. */
const ORDER: readonly Judgement[] = ['perfect', 'great', 'good', 'miss'];

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * The song strip: one tick per judgement over the full duration, lane-count section bands
 * underneath. Used both on screen (canvas element) and on the share card, so it takes plain
 * coordinates and draws nothing outside `[x, x+w] × [y, y+h]`. No `shadowBlur`.
 */
export function drawStrip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, data: StripData, labelFont = 10): void {
  const { timeline, sections } = data;
  const dur = Math.max(data.duration, 0.001);
  const bandH = Math.max(4, Math.round(h * 0.28));
  const gap = Math.max(2, Math.round(h * 0.07));
  const tickH = h - bandH - gap;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundRect(ctx, x, y, w, tickH, Math.min(4, tickH / 4));
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x, y + tickH - 1, w, 1);

  const n = timeline.j.length;
  for (const j of ORDER) {
    ctx.fillStyle = JUDGEMENT_COLORS[j];
    ctx.globalAlpha = j === 'perfect' ? 0.4 : j === 'miss' ? 1 : 0.85;
    const th = j === 'miss' ? tickH : j === 'good' ? tickH * 0.72 : j === 'great' ? tickH * 0.52 : tickH * 0.34;
    const tw = j === 'miss' ? Math.max(2, w / 500) : Math.max(1, w / 900);
    for (let i = 0; i < n; i++) {
      if (timeline.j[i] !== j) continue;
      const px = x + Math.min(1, Math.max(0, timeline.t[i] / dur)) * w;
      ctx.fillRect(px - tw / 2, y + tickH - th, tw, th);
    }
  }
  ctx.globalAlpha = 1;

  const by = y + tickH + gap;
  ctx.font = `700 ${labelFont}px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const start = Math.min(1, Math.max(0, s.time / dur));
    const end = i + 1 < sections.length ? Math.min(1, Math.max(0, sections[i + 1].time / dur)) : 1;
    if (end <= start) continue;
    const bx = x + start * w;
    const bw = (end - start) * w;
    const c = laneBandColor(i);
    ctx.fillStyle = hexToRgba(c, 0.22);
    ctx.fillRect(bx, by, bw, bandH);
    ctx.fillStyle = c;
    ctx.fillRect(bx, by, bw, Math.max(1, bandH * 0.12));
    if (i > 0) {
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(bx - 0.5, by, 1, bandH);
    }
    if (bw >= labelFont * 2.2 && bandH >= labelFont) {
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(s.lanes), bx + bw / 2, by + bandH / 2 + bandH * 0.08);
    }
  }
  ctx.restore();
}
