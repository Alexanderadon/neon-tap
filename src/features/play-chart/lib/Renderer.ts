import { COMBO_THRESHOLDS, LANE_COLORS, LANE_COUNT } from '@/shared/config/constants';
import { hexToRgba, renderBeam, renderGlowDot, renderNoteSprite, type NoteSprite } from '@/shared/lib/render';
import { ParticlePool, ScreenShake, LaneFlash } from '@/shared/lib/render';
import type { Judgement } from '@/entities/score';
import { NoteState, type NoteManager } from '../model/NoteManager';
import { computeLayout, type Layout } from './layout';

export interface FrameState {
  songTime: number;
  approachTime: number;
  beatPhase: number;
  combo: number;
  score: number;
  accuracy: number;
  progress: number;
  held: (lane: number) => boolean;
  lastJudgement: Judgement | null;
  lastJudgementAge: number;
  comboBreakAge: number;
  debug: { fps: number; worstMs: number; latencyMs: number; visibleNotes: number } | null;
}

const JUDGEMENT_COLOR: Record<Judgement, string> = {
  perfect: '#ffffff',
  great: '#00f0ff',
  good: '#b6ff00',
  miss: '#ff2bd6',
};

const FONT = "'Unbounded', 'Segoe UI', system-ui, sans-serif";

/**
 * Canvas 2D renderer. Static geometry (lanes, hit line, vignette) is rasterised once into an
 * offscreen layer; per-frame work is sprite blits + a few fills. No allocations in draw().
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  layout: Layout;
  private staticLayer: HTMLCanvasElement | OffscreenCanvas | null = null;
  private noteSprites: NoteSprite[] = [];
  private holdSprites: NoteSprite[] = [];
  private glowDots: NoteSprite[] = [];
  private beams: NoteSprite[] = [];
  readonly particles = new ParticlePool(300);
  readonly shake = new ScreenShake();
  readonly flash = new LaneFlash(LANE_COUNT);
  visibleNotes = 0;

  constructor(private readonly canvas: HTMLCanvasElement, private touch: boolean) {
    this.ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
    this.layout = computeLayout(300, 600, touch);
    this.resize();
  }

  setTouch(touch: boolean): void {
    if (this.touch === touch) return;
    this.touch = touch;
    this.resize();
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.layout = computeLayout(w, h, this.touch);
    this.buildSprites();
    this.buildStaticLayer();
  }

  private buildSprites(): void {
    const { laneWidth, noteHeight } = this.layout;
    const bodyW = laneWidth * 0.82;
    this.noteSprites = LANE_COLORS.map((c) => renderNoteSprite(c, bodyW, noteHeight, this.dpr));
    this.holdSprites = LANE_COLORS.map((c) => renderNoteSprite(c, bodyW * 0.5, noteHeight * 0.6, this.dpr));
    this.glowDots = LANE_COLORS.map((c) => renderGlowDot(c, 16, this.dpr));
    this.beams = LANE_COLORS.map((c) => renderBeam(hexToRgba(c, 0.55), laneWidth, this.layout.hitY, this.dpr));
  }

  private buildStaticLayer(): void {
    const { width, height, laneX, laneWidth, laneAreaWidth, hitY, noteHeight } = this.layout;
    const dpr = this.dpr;
    const layer = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width * dpr, height * dpr) : document.createElement('canvas');
    if (layer instanceof HTMLCanvasElement) {
      layer.width = width * dpr;
      layer.height = height * dpr;
    }
    const ctx = layer.getContext('2d') as CanvasRenderingContext2D;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, width, height);

    // Lane area with subtle gradient + separators.
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, 'rgba(255,255,255,0.0)');
    g.addColorStop(1, 'rgba(255,255,255,0.045)');
    ctx.fillStyle = g;
    ctx.fillRect(laneX, 0, laneAreaWidth, height);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= LANE_COUNT; i++) {
      const x = Math.round(laneX + i * laneWidth) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Hit line + receptors (glow rendered once here, so shadowBlur is fine).
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(laneX, hitY - 1.5, laneAreaWidth, 3);
    ctx.shadowBlur = 0;
    for (let i = 0; i < LANE_COUNT; i++) {
      const cx = laneX + (i + 0.5) * laneWidth;
      ctx.strokeStyle = hexToRgba(LANE_COLORS[i], 0.6);
      ctx.lineWidth = 2;
      ctx.shadowColor = LANE_COLORS[i];
      ctx.shadowBlur = 12;
      roundRect(ctx, cx - laneWidth * 0.41, hitY - noteHeight / 2, laneWidth * 0.82, noteHeight, noteHeight / 2.4);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Key hints under the hit line (desktop only).
    if (!this.touch) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = `700 ${Math.round(noteHeight * 0.75)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const keys = ['D', 'F', 'J', 'K'];
      for (let i = 0; i < LANE_COUNT; i++) ctx.fillText(keys[i], laneX + (i + 0.5) * laneWidth, hitY + noteHeight * 1.6);
    }

    // CRT vignette.
    const v = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, width, height);
    this.staticLayer = layer;
  }

  /** Visual feedback for a judgement at the hit line. */
  hitFeedback(lane: number, judgement: Judgement): void {
    const { laneX, laneWidth, hitY } = this.layout;
    const cx = laneX + (lane + 0.5) * laneWidth;
    if (judgement === 'miss') {
      this.shake.trigger(3);
      return;
    }
    this.flash.trigger(lane);
    const count = judgement === 'perfect' ? 10 : judgement === 'great' ? 7 : 4;
    this.particles.emit(cx, hitY, count, lane, 260, 5, 0.45);
  }

  comboMilestone(): void {
    this.shake.trigger(2.5);
    const { laneX, laneAreaWidth, hitY } = this.layout;
    for (let i = 0; i < LANE_COUNT; i++) this.particles.emit(laneX + ((i + 0.5) * laneAreaWidth) / LANE_COUNT, hitY, 12, i, 420, 6, 0.8);
  }

  comboBreak(x: number, y: number, combo: number): void {
    const count = Math.min(60, 10 + combo / 4);
    for (let i = 0; i < LANE_COUNT; i++) this.particles.emit(x, y, Math.round(count / LANE_COUNT), i, 380, 5, 0.7);
  }

  update(dt: number): void {
    this.particles.update(dt);
    this.shake.update(dt);
    this.flash.update(dt);
  }

  draw(notes: NoteManager, s: FrameState): void {
    const ctx = this.ctx;
    const L = this.layout;
    const { width, height, laneX, laneWidth, hitY } = L;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.shake.offsetX, this.shake.offsetY);

    if (this.staticLayer) ctx.drawImage(this.staticLayer, 0, 0, width, height);

    // Background pulse on the beat.
    const pulse = Math.max(0, 1 - s.beatPhase) ** 3;
    if (pulse > 0.02) {
      ctx.fillStyle = `rgba(0,240,255,${(0.05 * pulse).toFixed(3)})`;
      ctx.fillRect(laneX, 0, L.laneAreaWidth, height);
    }

    // Lane flashes + held receptors.
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const f = this.flash.intensity(lane);
      const heldNow = s.held(lane);
      if (f > 0 || heldNow) {
        ctx.globalAlpha = Math.max(f, heldNow ? 0.35 : 0);
        ctx.drawImage(this.beams[lane].canvas, laneX + lane * laneWidth, 0, laneWidth, hitY);
        ctx.globalAlpha = 1;
      }
    }

    // Notes.
    const pxPerSec = hitY / s.approachTime;
    let visible = 0;
    const horizon = s.songTime + s.approachTime + 0.2;
    for (let i = notes.firstActive; i < notes.count; i++) {
      const n = notes.pool[i];
      if (n.time > horizon) break;
      if (n.state === NoteState.Hit || n.state === NoteState.Released) continue;
      const cx = laneX + (n.lane + 0.5) * laneWidth;
      const y = hitY - (n.time - s.songTime) * pxPerSec;
      if (n.duration > 0) {
        const yEnd = hitY - (n.endTime - s.songTime) * pxPerSec;
        const top = Math.max(-40, yEnd);
        const bottom = n.state === NoteState.Holding ? hitY : Math.min(height + 40, y);
        if (bottom > top) {
          ctx.globalAlpha = n.state === NoteState.Missed ? 0.25 : 0.55;
          ctx.fillStyle = LANE_COLORS[n.lane];
          ctx.fillRect(cx - laneWidth * 0.18, top, laneWidth * 0.36, bottom - top);
          ctx.globalAlpha = 1;
          const hs = this.holdSprites[n.lane];
          ctx.drawImage(hs.canvas, cx - hs.width / 2, yEnd - hs.height / 2, hs.width, hs.height);
        }
        if (n.state === NoteState.Holding) {
          visible++;
          continue;
        }
      }
      if (y < -60 || y > height + 60) continue;
      const sp = this.noteSprites[n.lane];
      if (n.state === NoteState.Missed) ctx.globalAlpha = 0.3;
      ctx.drawImage(sp.canvas, cx - sp.width / 2, y - sp.height / 2, sp.width, sp.height);
      ctx.globalAlpha = 1;
      visible++;
    }
    this.visibleNotes = visible;

    // Particles.
    const p = this.particles;
    for (let i = 0; i < p.capacity; i++) {
      if (p.life[i] <= 0) continue;
      const dot = this.glowDots[p.color[i]];
      const size = p.size[i] * 2 * (p.life[i] / p.maxLife[i]);
      ctx.globalAlpha = Math.min(1, p.life[i] / p.maxLife[i] + 0.2);
      ctx.drawImage(dot.canvas, p.x[i] - size / 2, p.y[i] - size / 2, size, size);
    }
    ctx.globalAlpha = 1;

    this.drawHud(s);
  }

  private drawHud(s: FrameState): void {
    const ctx = this.ctx;
    const { width, height, laneX, laneAreaWidth, hitY, portrait } = this.layout;
    const centerX = laneX + laneAreaWidth / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Combo: font scales with combo, colour by threshold (GDD §1.1).
    if (s.combo >= 2) {
      const size = 32 + Math.min(s.combo, 500) * 0.06;
      let color = 'rgba(255,255,255,0.9)';
      for (const t of COMBO_THRESHOLDS) {
        if (s.combo >= t.combo) {
          color = t.color;
          break;
        }
      }
      const pulse = s.combo >= 500 ? 1 + 0.06 * Math.sin(performance.now() / 90) : 1;
      ctx.font = `900 ${Math.round(size * pulse)}px ${FONT}`;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 0; // no blur in the loop; the glow is faked with a second translucent pass
      ctx.globalAlpha = 0.35;
      ctx.fillText(String(s.combo), centerX, hitY * 0.42 + 2);
      ctx.globalAlpha = 1;
      ctx.fillText(String(s.combo), centerX, hitY * 0.42);
      ctx.font = `400 12px ${FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('COMBO', centerX, hitY * 0.42 + size * 0.7);
    } else if (s.comboBreakAge >= 0 && s.comboBreakAge < 0.4) {
      ctx.font = `900 40px ${FONT}`;
      ctx.fillStyle = `rgba(255,43,214,${1 - s.comboBreakAge / 0.4})`;
      ctx.fillText('×', centerX, hitY * 0.42);
    }

    // Last judgement.
    if (s.lastJudgement && s.lastJudgementAge < 0.5) {
      const a = 1 - s.lastJudgementAge / 0.5;
      const scale = 1 + (1 - Math.min(1, s.lastJudgementAge / 0.08)) * 0.35;
      ctx.font = `700 ${Math.round(22 * scale)}px ${FONT}`;
      ctx.fillStyle = JUDGEMENT_COLOR[s.lastJudgement];
      ctx.globalAlpha = a;
      ctx.fillText(s.lastJudgement.toUpperCase(), centerX, hitY * 0.62);
      ctx.globalAlpha = 1;
    }

    // Score / accuracy.
    ctx.font = `700 ${portrait ? 18 : 22}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(s.score.toLocaleString('ru-RU'), 14, 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = s.accuracy >= 0.95 ? '#ffd700' : 'rgba(255,255,255,0.85)';
    ctx.fillText(`${(s.accuracy * 100).toFixed(2)}%`, width - 14, 30);

    // Progress bar (top edge).
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, 0, width, 3);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(0, 0, width * s.progress, 3);

    if (s.debug) {
      ctx.textAlign = 'left';
      ctx.font = `400 11px monospace`;
      ctx.fillStyle = s.debug.fps < 50 ? '#ff2bd6' : '#b6ff00';
      const y = height - 14;
      ctx.fillText(
        `${s.debug.fps} fps · worst ${s.debug.worstMs} ms · notes ${s.debug.visibleNotes} · particles ${this.particles.alive} · latency ${s.debug.latencyMs} ms · t ${s.songTime.toFixed(3)}`,
        10,
        y,
      );
    }
  }

  /** Overlay for countdown / pause. */
  drawOverlayText(title: string, subtitle?: string): void {
    const ctx = this.ctx;
    const { width, height } = this.layout;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = 'rgba(5,6,10,0.55)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.min(64, width / 6)}px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, width / 2, height * 0.42);
    if (subtitle) {
      ctx.font = `400 15px ${FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(subtitle, width / 2, height * 0.42 + 56);
    }
  }
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
