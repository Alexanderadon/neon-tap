import { dict, fmt } from '@/shared/i18n';
import { hexToRgba } from '@/shared/lib/render';
import type { Section } from '@/entities/chart';
import { formatClock, type PlayResult } from '@/entities/score';
import { drawStrip } from './drawStrip';
import { BG_COLOR, FONT_DISPLAY, RANK_COLORS } from './palette';

export const SHARE_URL = 'neon-tap-virid.vercel.app';
export const CARD_W = 1080;
export const CARD_H = 1350;

export interface ShareCardData {
  title: string;
  artist: string;
  result: PlayResult;
  sections: readonly Section[];
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

function songLine(d: ShareCardData): string {
  return d.artist ? `${d.title} — ${d.artist}` : d.title;
}

/** Plain-text summary for the clipboard / share sheet. */
export function shareSummary(d: ShareCardData): string {
  const r = d.result;
  const score = r.score.toLocaleString('ru-RU');
  if (r.failed) {
    const last = r.timeline.t.length ? r.timeline.t[r.timeline.t.length - 1] : 0;
    return fmt(dict.shareTextFailed, { song: songLine(d), t: formatClock(last), score, combo: r.maxCombo, url: SHARE_URL });
  }
  return fmt(dict.shareText, {
    song: songLine(d),
    rank: r.rank,
    acc: (r.accuracy * 100).toFixed(2),
    score,
    combo: r.maxCombo,
    url: SHARE_URL,
  });
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, weight: number, size: number): number {
  let s = size;
  for (;;) {
    ctx.font = `${weight} ${s}px ${FONT_DISPLAY}`;
    if (ctx.measureText(text).width <= maxWidth || s <= 18) return s;
    s -= 2;
  }
}

/** Render the 1080×1350 share card offscreen. One-shot, so `shadowBlur` is fine here. */
export function renderShareCard(d: ShareCardData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const r = d.result;
  const accent = r.failed ? RANK_COLORS.D : RANK_COLORS[r.rank];
  const M = 80;
  const innerW = CARD_W - M * 2;

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.strokeStyle = 'rgba(0,240,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= CARD_W; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, CARD_H);
    ctx.stroke();
  }
  for (let y = 0; y <= CARD_H; y += 90) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(CARD_W, y + 0.5);
    ctx.stroke();
  }
  const halo = ctx.createRadialGradient(CARD_W / 2, 600, 0, CARD_W / 2, 600, 520);
  halo.addColorStop(0, hexToRgba(accent, 0.22));
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `900 44px ${FONT_DISPLAY}`;
  ctx.fillStyle = '#00f0ff';
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 24;
  ctx.fillText(dict.appTitle, M, 120);
  ctx.shadowBlur = 0;
  ctx.font = `400 24px ${FONT_DISPLAY}`;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(dict.tagline, M, 160);

  const titleSize = fitText(ctx, d.title, innerW, 700, 58);
  ctx.font = `700 ${titleSize}px ${FONT_DISPLAY}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(d.title, M, 260);
  if (d.artist) {
    const artistSize = fitText(ctx, d.artist, innerW, 400, 32);
    ctx.font = `400 ${artistSize}px ${FONT_DISPLAY}`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(d.artist, M, 310);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  if (r.failed) {
    ctx.font = `900 150px ${FONT_DISPLAY}`;
    ctx.shadowBlur = 60;
    ctx.fillText(dict.failed, CARD_W / 2, 690);
    ctx.fillText(dict.failed, CARD_W / 2, 690);
    ctx.shadowBlur = 0;
    ctx.font = `400 30px ${FONT_DISPLAY}`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(dict.failedHint, CARD_W / 2, 800);
  } else {
    ctx.font = `900 ${r.rank.length > 1 ? 360 : 420}px ${FONT_DISPLAY}`;
    ctx.shadowBlur = 70;
    ctx.fillText(r.rank, CARD_W / 2, 740);
    ctx.fillText(r.rank, CARD_W / 2, 740);
    ctx.shadowBlur = 0;
    ctx.font = `700 72px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${(r.accuracy * 100).toFixed(2)}%`, CARD_W / 2, 850);
    if (r.fullCombo) {
      ctx.font = `900 28px ${FONT_DISPLAY}`;
      ctx.fillStyle = '#ffd700';
      ctx.fillText(dict.fullCombo, CARD_W / 2, 905);
    }
  }

  const boxes: Array<[string, string]> = [
    [dict.score, r.score.toLocaleString('ru-RU')],
    [dict.maxCombo, String(r.maxCombo)],
    [dict.perfect, String(r.counts.perfect)],
  ];
  const gap = 20;
  const bw = (innerW - gap * 2) / 3;
  const by = 940;
  const bh = 120;
  for (let i = 0; i < boxes.length; i++) {
    const bx = M + i * (bw + gap);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    ctx.font = `400 22px ${FONT_DISPLAY}`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(boxes[i][0].toUpperCase(), bx + bw / 2, by + 42);
    const vs = fitText(ctx, boxes[i][1], bw - 24, 700, 44);
    ctx.font = `700 ${vs}px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(boxes[i][1], bx + bw / 2, by + 96);
  }

  const stripY = 1100;
  const stripH = 100;
  drawStrip(ctx, M, stripY, innerW, stripH, { timeline: r.timeline, sections: d.sections, duration: r.duration }, 20);
  ctx.font = `400 22px ${FONT_DISPLAY}`;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'left';
  ctx.fillText(formatClock(0), M, stripY + stripH + 32);
  ctx.textAlign = 'right';
  ctx.fillText(formatClock(r.duration), M + innerW, stripY + stripH + 32);

  ctx.textAlign = 'center';
  ctx.font = `700 30px ${FONT_DISPLAY}`;
  ctx.fillStyle = '#00f0ff';
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 18;
  ctx.fillText(SHARE_URL, CARD_W / 2, CARD_H - 60);
  ctx.shadowBlur = 0;
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

async function ensureFonts(): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts?.load) return;
  try {
    await Promise.all([fonts.load(`900 100px Unbounded`), fonts.load(`700 40px Unbounded`), fonts.load(`400 24px Unbounded`)]);
  } catch {
    /* fallback fonts are fine */
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Render the card and hand it to the share sheet (files supported) or download it. */
export async function shareResultCard(d: ShareCardData, fileName: string): Promise<ShareOutcome> {
  await ensureFonts();
  const blob = await toBlob(renderShareCard(d));
  const text = shareSummary(d);
  if (typeof File !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text, title: dict.appTitle });
        return 'shared';
      } catch (e) {
        if ((e as { name?: string }).name === 'AbortError') return 'cancelled';
      }
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}

/** Copy the text summary; returns false when no clipboard is available. */
export async function copySummary(d: ShareCardData): Promise<boolean> {
  const text = shareSummary(d);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
