import { COMBO_THRESHOLDS, KEY_LABELS, LANE_COLORS, LANE_COUNT, MAX_LANES } from '@/shared/config/constants';
import { hexToRgba, renderBeam, renderGlowDot, renderHeart, renderNoteSprite, renderSpell, type NoteSprite } from '@/shared/lib/render';
import { ParticlePool, ScreenShake, LaneFlash } from '@/shared/lib/render';
import type { Judgement } from '@/entities/score';
import type { SpellKind } from '@/entities/chart';
import { NoteState, type NoteManager, type PooledNote } from '../model/NoteManager';
import { computeLayout, type Layout } from './layout';

export interface FrameState {
  songTime: number;
  approachTime: number;
  beatPhase: number;
  combo: number;
  /** Seconds since the combo last grew (Infinity when it hasn't). */
  comboAge: number;
  score: number;
  accuracy: number;
  progress: number;
  hearts: number;
  maxHearts: number;
  /** Seconds since a heart was lost (Infinity when none). */
  heartLostAge: number;
  /** Remaining slow-spell time as 0..1, or -1 when inactive. */
  slowRemaining: number;
  held: (lane: number) => boolean;
  lastJudgement: Judgement | null;
  lastJudgementAge: number;
  comboBreakAge: number;
  debug: { fps: number; worstMs: number; latencyMs: number; visibleNotes: number; offsetMs: number; rate: number } | null;
}

const JUDGEMENT_COLOR: Record<Judgement, string> = {
  perfect: '#ffffff',
  great: '#00f0ff',
  good: '#b6ff00',
  miss: '#ff2bd6',
};

const FONT = "'Unbounded', 'Segoe UI', system-ui, sans-serif";
const HEART_COLOR = '#ff2bd6';
const TRANSITION_SEC = 0.6;
const RING_POOL = 16;

/** Everything that depends on the lane count: geometry, static layer, sized sprites. */
interface LaneSet {
  lanes: number;
  layout: Layout;
  staticLayer: HTMLCanvasElement | OffscreenCanvas;
  noteSprites: NoteSprite[];
  holdSprites: NoteSprite[];
  beams: NoteSprite[];
  spells: Record<SpellKind, NoteSprite>;
}

/** Circles hang in the upper part of the field; three staggered heights so a group reads as a path. */
export function circleY(L: Layout, seq: number): number {
  return L.hitY * [0.34, 0.5, 0.42][(Math.max(1, seq) - 1) % 3];
}

/**
 * Canvas 2D renderer. Static geometry (lanes, hit line, vignette) is rasterised once per lane
 * count into an offscreen layer; per-frame work is sprite blits + a few fills. No allocations
 * in draw(). Lane-count changes cross-fade between two static layers with a glitch/scan/flash FX.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private width = 300;
  private height = 600;
  private sets = new Map<number, LaneSet>();
  private laneCounts: number[];
  private current = LANE_COUNT;
  private transition: { from: number; to: number; start: number } | null = null;
  private glowDots: NoteSprite[] = [];
  private heartOn!: NoteSprite;
  private heartOff!: NoteSprite;
  private heartSize = 18;
  // Expanding rings on perfect hits / circle hits (SoA pool).
  private readonly ringX = new Float32Array(RING_POOL);
  private readonly ringY = new Float32Array(RING_POOL);
  private readonly ringAge = new Float32Array(RING_POOL).fill(1);
  private readonly ringColor = new Uint8Array(RING_POOL);
  private ringCursor = 0;
  private shockAge = 1;
  readonly particles = new ParticlePool(300);
  readonly shake = new ScreenShake();
  readonly flash = new LaneFlash(MAX_LANES);
  visibleNotes = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private touch: boolean,
    laneCounts: readonly number[] = [LANE_COUNT],
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
    this.laneCounts = [...new Set([...laneCounts, LANE_COUNT])];
    this.resize();
  }

  /** Geometry of the active lane count (used for pointer → lane). */
  get layout(): Layout {
    return this.set(this.current).layout;
  }

  get lanes(): number {
    return this.current;
  }

  private set(n: number): LaneSet {
    let s = this.sets.get(n);
    if (!s) {
      s = this.buildSet(n);
      this.sets.set(n, s);
    }
    return s;
  }

  setTouch(touch: boolean): void {
    if (this.touch === touch) return;
    this.touch = touch;
    this.resize();
  }

  resize(): void {
    this.width = this.canvas.clientWidth || window.innerWidth;
    this.height = this.canvas.clientHeight || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.sets.clear();
    for (const n of this.laneCounts) this.sets.set(n, this.buildSet(n));
    this.glowDots = LANE_COLORS.map((c) => renderGlowDot(c, 16, this.dpr));
    this.heartSize = this.height > this.width ? 16 : 20;
    this.heartOn = renderHeart(HEART_COLOR, this.heartSize, this.dpr, true);
    this.heartOff = renderHeart(HEART_COLOR, this.heartSize, this.dpr, false);
  }

  /** Switch the playfield to `n` lanes; animated unless `instant`. */
  setLanes(n: number, instant = false): void {
    if (n === this.current) return;
    const from = this.current;
    this.current = n;
    if (instant) {
      this.transition = null;
      return;
    }
    this.transition = { from, to: n, start: performance.now() / 1000 };
    this.shake.trigger(4);
    const L = this.set(n).layout;
    for (let i = 0; i < n; i++) {
      this.particles.emit(L.laneX + (i + 0.5) * L.laneWidth, L.hitY, 10, i % LANE_COLORS.length, 380, 6, 0.8);
      this.flash.trigger(i);
    }
  }

  private buildSet(n: number): LaneSet {
    const layout = computeLayout(this.width, this.height, this.touch, n);
    const { laneWidth, noteHeight, hitY } = layout;
    const bodyW = laneWidth * 0.82;
    const colors = Array.from({ length: n }, (_, i) => LANE_COLORS[i % LANE_COLORS.length]);
    const spellSize = Math.round(Math.min(laneWidth * 0.7, noteHeight * 2.6));
    return {
      lanes: n,
      layout,
      staticLayer: this.buildStaticLayer(layout),
      noteSprites: colors.map((c) => renderNoteSprite(c, bodyW, noteHeight, this.dpr)),
      holdSprites: colors.map((c) => renderNoteSprite(c, bodyW * 0.5, noteHeight * 0.6, this.dpr)),
      beams: colors.map((c) => renderBeam(hexToRgba(c, 0.55), laneWidth, hitY, this.dpr)),
      spells: { slow: renderSpell('slow', spellSize, this.dpr), heart: renderSpell('heart', spellSize, this.dpr) },
    };
  }

  private buildStaticLayer(L: Layout): HTMLCanvasElement | OffscreenCanvas {
    const { width, height, laneX, laneWidth, laneAreaWidth, hitY, noteHeight, lanes } = L;
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

    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, 'rgba(255,255,255,0.0)');
    g.addColorStop(1, 'rgba(255,255,255,0.045)');
    ctx.fillStyle = g;
    ctx.fillRect(laneX, 0, laneAreaWidth, height);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= lanes; i++) {
      const x = Math.round(laneX + i * laneWidth) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(laneX, hitY - 1.5, laneAreaWidth, 3);
    ctx.shadowBlur = 0;
    for (let i = 0; i < lanes; i++) {
      const cx = laneX + (i + 0.5) * laneWidth;
      const color = LANE_COLORS[i % LANE_COLORS.length];
      ctx.strokeStyle = hexToRgba(color, 0.6);
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      roundRect(ctx, cx - laneWidth * 0.41, hitY - noteHeight / 2, laneWidth * 0.82, noteHeight, noteHeight / 2.4);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    if (!this.touch) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = `700 ${Math.round(noteHeight * 0.75)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const keys = KEY_LABELS[lanes] ?? [];
      for (let i = 0; i < lanes; i++) ctx.fillText(keys[i] ?? '', laneX + (i + 0.5) * laneWidth, hitY + noteHeight * 1.6);
    }

    const v = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, width, height);
    return layer;
  }

  /** Visual feedback for a judgement at the hit line (or at a circle when `circleSeq` > 0), in the note's own lane geometry. */
  hitFeedback(lane: number, lanes: number, judgement: Judgement, circleSeq = 0): void {
    const L = this.set(lanes).layout;
    const { laneX, laneWidth } = L;
    const y = circleSeq > 0 ? circleY(L, circleSeq) : L.hitY;
    const cx = laneX + (lane + 0.5) * laneWidth;
    if (judgement === 'miss') {
      this.shake.trigger(3);
      return;
    }
    this.flash.trigger(lane);
    const color = lane % LANE_COLORS.length;
    const count = (judgement === 'perfect' ? 10 : judgement === 'great' ? 7 : 4) * (circleSeq > 0 ? 3 : 1);
    this.particles.emit(cx, y, count, color, circleSeq > 0 ? 380 : 260, 5, 0.45);
    if (judgement === 'perfect' || circleSeq > 0) this.ring(cx, y, color);
  }

  private ring(x: number, y: number, color: number): void {
    const i = this.ringCursor;
    this.ringCursor = (this.ringCursor + 1) % RING_POOL;
    this.ringX[i] = x;
    this.ringY[i] = y;
    this.ringAge[i] = 0;
    this.ringColor[i] = color;
  }

  /** Catching a spell: a big burst in the spell's colour. */
  spellFeedback(lane: number, lanes: number, kind: SpellKind): void {
    const { laneX, laneWidth, hitY } = this.set(lanes).layout;
    const cx = laneX + (lane + 0.5) * laneWidth;
    this.particles.emit(cx, hitY, 40, kind === 'slow' ? 0 : 1, 460, 7, 0.9);
    this.shake.trigger(2);
  }

  comboMilestone(): void {
    this.shake.trigger(2.5);
    this.shockAge = 0;
    const { laneX, laneWidth, hitY, lanes } = this.layout;
    for (let i = 0; i < lanes; i++) this.particles.emit(laneX + (i + 0.5) * laneWidth, hitY, 12, i % LANE_COLORS.length, 420, 6, 0.8);
  }

  comboBreak(x: number, y: number, combo: number): void {
    const count = Math.min(60, 10 + combo / 4);
    for (let i = 0; i < 4; i++) this.particles.emit(x, y, Math.round(count / 4), i, 380, 5, 0.7);
  }

  heartLost(index: number): void {
    const { x, y } = this.heartPos(index);
    this.particles.emit(x, y, 14, 1, 220, 4, 0.6);
    this.shake.trigger(4);
  }

  update(dt: number): void {
    this.particles.update(dt);
    this.shake.update(dt);
    this.flash.update(dt);
    for (let i = 0; i < RING_POOL; i++) if (this.ringAge[i] < 1) this.ringAge[i] += dt / 0.35;
    if (this.shockAge < 1) this.shockAge += dt / 0.5;
  }

  private heartPos(index: number): { x: number; y: number } {
    const step = this.heartSize * 1.25;
    return { x: 14 + this.heartSize / 2 + index * step, y: 50 + this.heartSize / 2 };
  }

  draw(notes: NoteManager, s: FrameState): void {
    const ctx = this.ctx;
    const cur = this.set(this.current);
    const L = cur.layout;
    const { width, height, laneX, laneWidth, hitY } = L;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.shake.offsetX, this.shake.offsetY);

    // Static layer(s): cross-fade during a lane-count transition.
    const tr = this.transition;
    const trAge = tr ? (performance.now() / 1000 - tr.start) / TRANSITION_SEC : 1;
    if (tr && trAge < 1) {
      const e = trAge * trAge * (3 - 2 * trAge);
      ctx.drawImage(this.set(tr.from).staticLayer, 0, 0, width, height);
      ctx.globalAlpha = e;
      ctx.drawImage(cur.staticLayer, 0, 0, width, height);
      ctx.globalAlpha = 1;
    } else {
      if (tr) this.transition = null;
      ctx.drawImage(cur.staticLayer, 0, 0, width, height);
    }

    // Background pulse on the beat (stronger with more lanes = choruses); cyan wash while slowed.
    const pulse = Math.max(0, 1 - s.beatPhase) ** 3;
    const energy = 0.04 + 0.02 * Math.max(0, this.current - 3);
    const slowTint = s.slowRemaining >= 0 ? 0.06 : 0;
    const alpha = energy * pulse + slowTint;
    if (alpha > 0.02) {
      ctx.fillStyle = this.current >= 5 ? `rgba(255,43,214,${alpha.toFixed(3)})` : `rgba(0,240,255,${alpha.toFixed(3)})`;
      ctx.fillRect(laneX, 0, L.laneAreaWidth, height);
    }

    for (let lane = 0; lane < this.current; lane++) {
      const f = this.flash.intensity(lane);
      const heldNow = s.held(lane);
      if (f > 0 || heldNow) {
        ctx.globalAlpha = Math.max(f, heldNow ? 0.35 : 0);
        ctx.drawImage(cur.beams[lane].canvas, laneX + lane * laneWidth, 0, laneWidth, hitY);
        ctx.globalAlpha = 1;
      }
    }

    // Receptor pulse on the beat.
    if (pulse > 0.05) {
      ctx.globalAlpha = 0.35 * pulse;
      for (let lane = 0; lane < this.current; lane++) {
        const sp = cur.noteSprites[lane];
        const cx = laneX + (lane + 0.5) * laneWidth;
        ctx.drawImage(sp.canvas, cx - sp.width / 2, hitY - sp.height / 2, sp.width, sp.height);
      }
      ctx.globalAlpha = 1;
    }

    // Notes — each drawn in the geometry of its own section.
    const pxPerSec = hitY / s.approachTime;
    let visible = 0;
    const horizon = s.songTime + s.approachTime + 0.2;
    const spin = (s.songTime * 1.5) % (Math.PI * 2);
    for (let i = notes.firstActive; i < notes.count; i++) {
      const n = notes.pool[i];
      if (n.time > horizon) break;
      if (n.state === NoteState.Hit || n.state === NoteState.Released) continue;
      const set = n.lanes === this.current ? cur : this.set(n.lanes);
      const lw = set.layout.laneWidth;
      const cx = set.layout.laneX + (n.lane + 0.5) * lw;
      if (n.kind === 'circle') {
        this.drawCircle(set, n, cx, s);
        visible++;
        continue;
      }
      const y = hitY - (n.time - s.songTime) * pxPerSec;
      if (n.duration > 0) {
        const yEnd = hitY - (n.endTime - s.songTime) * pxPerSec;
        const top = Math.max(-40, yEnd);
        const bottom = n.state === NoteState.Holding ? hitY : Math.min(height + 40, y);
        if (bottom > top) {
          ctx.globalAlpha = n.state === NoteState.Missed ? 0.25 : 0.55;
          ctx.fillStyle = LANE_COLORS[n.lane % LANE_COLORS.length];
          ctx.fillRect(cx - lw * 0.18, top, lw * 0.36, bottom - top);
          ctx.globalAlpha = 1;
          const hs = set.holdSprites[n.lane];
          ctx.drawImage(hs.canvas, cx - hs.width / 2, yEnd - hs.height / 2, hs.width, hs.height);
        }
        if (n.state === NoteState.Holding) {
          visible++;
          continue;
        }
      }
      if (y < -60 || y > height + 60) continue;
      if (n.state === NoteState.Missed) ctx.globalAlpha = 0.3;
      if (n.kind === 'slow' || n.kind === 'heart') {
        const sp = set.spells[n.kind];
        const bob = 1 + 0.06 * Math.sin(s.songTime * 6 + i);
        ctx.save();
        ctx.translate(cx, y);
        ctx.rotate(spin);
        ctx.drawImage(sp.canvas, (-sp.width / 2) * bob, (-sp.height / 2) * bob, sp.width * bob, sp.height * bob);
        ctx.restore();
      } else {
        const sp = set.noteSprites[n.lane];
        // Motion trail: a faint copy just behind the note.
        if (n.state === NoteState.Pending) {
          ctx.globalAlpha = 0.18;
          ctx.drawImage(sp.canvas, cx - sp.width / 2, y - sp.height / 2 - set.layout.noteHeight * 0.9, sp.width, sp.height);
          ctx.globalAlpha = 1;
        }
        ctx.drawImage(sp.canvas, cx - sp.width / 2, y - sp.height / 2, sp.width, sp.height);
      }
      ctx.globalAlpha = 1;
      visible++;
    }
    this.visibleNotes = visible;

    // Perfect / circle rings.
    ctx.lineWidth = 2;
    for (let i = 0; i < RING_POOL; i++) {
      const a = this.ringAge[i];
      if (a >= 1) continue;
      ctx.strokeStyle = LANE_COLORS[this.ringColor[i]];
      ctx.globalAlpha = 1 - a;
      ctx.beginPath();
      ctx.arc(this.ringX[i], this.ringY[i], 8 + a * (laneWidth * 0.55), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

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

    // Milestone shockwave: two lines racing away from the hit line.
    if (this.shockAge < 1) {
      const a = this.shockAge;
      ctx.globalAlpha = 1 - a;
      ctx.fillStyle = '#ffffff';
      const d = a * hitY;
      ctx.fillRect(laneX, hitY - d, L.laneAreaWidth, 2);
      ctx.fillRect(laneX, Math.min(height - 2, hitY + d * 0.35), L.laneAreaWidth, 2);
      ctx.globalAlpha = 1;
    }

    if (tr && trAge < 1) this.drawTransitionFx(tr.to, trAge);
    this.drawHud(s);
  }

  /**
   * osu!-style hit circle: sits still at a fixed height in its lane while an approach ring shrinks
   * onto it. Tap (or press the lane key) when the ring meets the circle. Numbered within its group.
   */
  private drawCircle(set: LaneSet, n: PooledNote, cx: number, s: FrameState): void {
    const ctx = this.ctx;
    const L = set.layout;
    const cy = circleY(L, n.seq);
    const r = Math.max(16, Math.min(L.laneWidth * 0.42, 40));
    const dt = n.time - s.songTime;
    if (dt > s.approachTime || dt < -0.4) return;
    const t = Math.max(0, Math.min(1, dt / s.approachTime));
    const color = LANE_COLORS[n.lane % LANE_COLORS.length];
    const missed = n.state === NoteState.Missed;
    const fade = dt < 0 ? Math.max(0, 1 + dt / 0.4) : 1;
    const base = (missed ? 0.3 : 1) * fade;
    ctx.globalAlpha = base;
    const dot = this.glowDots[n.lane % LANE_COLORS.length];
    ctx.drawImage(dot.canvas, cx - r * 1.6, cy - r * 1.6, r * 3.2, r * 3.2);
    ctx.fillStyle = 'rgba(5,6,10,0.92)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(3, r * 0.14);
    ctx.strokeStyle = color;
    ctx.stroke();
    if (!missed) {
      // Approach ring: 2.6 r → r as the note arrives.
      ctx.lineWidth = 2;
      ctx.globalAlpha = (0.35 + 0.65 * (1 - t)) * fade;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, r * (1 + 1.6 * t), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = base;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(r * 1.1)}px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(n.seq || 1), cx, cy + 1);
    ctx.globalAlpha = 1;
  }

  /** Lane-count change: white flash, scan line, glitch bands and a "×N" pop. */
  private drawTransitionFx(to: number, t: number): void {
    const ctx = this.ctx;
    const { width, height, laneX, laneAreaWidth } = this.layout;
    ctx.fillStyle = `rgba(255,255,255,${(0.55 * Math.max(0, 1 - t * 4)).toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);
    const sy = t * height;
    const grad = ctx.createLinearGradient(0, sy - 40, 0, sy + 4);
    grad.addColorStop(0, 'rgba(0,240,255,0)');
    grad.addColorStop(1, 'rgba(0,240,255,0.7)');
    ctx.fillStyle = grad;
    ctx.fillRect(laneX, sy - 40, laneAreaWidth, 44);
    if (t < 0.6) {
      for (let i = 0; i < 6; i++) {
        const y = ((i * 977 + Math.floor(t * 40) * 131) % height) | 0;
        const h = 4 + ((i * 37) % 14);
        const dx = (((i * 53 + Math.floor(t * 60) * 17) % 40) - 20) * (1 - t);
        ctx.fillStyle = i % 2 ? 'rgba(255,43,214,0.22)' : 'rgba(0,240,255,0.22)';
        ctx.fillRect(laneX + dx, y, laneAreaWidth, h);
      }
    }
    const pop = Math.min(1, t * 2.5);
    const scale = 2.6 - 1.6 * (1 - (1 - pop) ** 3);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(64 * scale)}px ${FONT}`;
    ctx.fillStyle = to >= 5 ? '#ff2bd6' : '#00f0ff';
    ctx.globalAlpha = Math.min(1, pop * 1.5) * (1 - Math.max(0, t - 0.7) / 0.3);
    ctx.fillText(`×${to}`, width / 2, height * 0.34);
    ctx.font = `400 13px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(to > 4 ? 'ПОЛОСЫ РАСКРЫЛИСЬ' : to < 4 ? 'ПОЛОСЫ СЖАЛИСЬ' : 'ПОЛОСЫ', width / 2, height * 0.34 + 44 * scale);
    ctx.globalAlpha = 1;
  }

  private drawHud(s: FrameState): void {
    const ctx = this.ctx;
    const { width, height, laneX, laneAreaWidth, hitY, portrait } = this.layout;
    const centerX = laneX + laneAreaWidth / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Combo: font scales with combo, colour by threshold, pops on every hit and trembles from 20 (GDD §1.1).
    if (s.combo >= 2) {
      const base = 32 + Math.min(s.combo, 500) * 0.06;
      let color = 'rgba(255,255,255,0.9)';
      for (const t of COMBO_THRESHOLDS) {
        if (s.combo >= t.combo) {
          color = t.color;
          break;
        }
      }
      const pop = s.comboAge < 0.16 ? (1 - s.comboAge / 0.16) ** 2 : 0;
      const pulse = s.combo >= 500 ? 1 + 0.06 * Math.sin(performance.now() / 90) : 1;
      const size = Math.round(base * pulse * (1 + 0.28 * pop));
      let jx = 0;
      let jy = 0;
      if (s.combo >= 20) {
        const amp = Math.min(3, 0.7 + s.combo / 120);
        jx = (Math.random() * 2 - 1) * amp;
        jy = (Math.random() * 2 - 1) * amp;
      }
      const x = centerX + jx;
      const y = hitY * 0.42 + jy;
      ctx.font = `900 ${size}px ${FONT}`;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.fillText(String(s.combo), x, y + 2);
      ctx.globalAlpha = 1;
      ctx.fillText(String(s.combo), x, y);
      ctx.font = `400 12px ${FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('COMBO', centerX, hitY * 0.42 + base * 0.7);
    } else if (s.comboBreakAge >= 0 && s.comboBreakAge < 0.4) {
      ctx.font = `900 40px ${FONT}`;
      ctx.fillStyle = `rgba(255,43,214,${1 - s.comboBreakAge / 0.4})`;
      ctx.fillText('×', centerX, hitY * 0.42);
    }

    if (s.lastJudgement && s.lastJudgementAge < 0.5) {
      const a = 1 - s.lastJudgementAge / 0.5;
      const scale = 1 + (1 - Math.min(1, s.lastJudgementAge / 0.08)) * 0.35;
      ctx.font = `700 ${Math.round(22 * scale)}px ${FONT}`;
      ctx.fillStyle = JUDGEMENT_COLOR[s.lastJudgement];
      ctx.globalAlpha = a;
      ctx.fillText(s.lastJudgement.toUpperCase(), centerX, hitY * 0.62);
      ctx.globalAlpha = 1;
    }

    ctx.font = `700 ${portrait ? 18 : 22}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(s.score.toLocaleString('ru-RU'), 14, 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = s.accuracy >= 0.95 ? '#ffd700' : 'rgba(255,255,255,0.85)';
    ctx.fillText(`${(s.accuracy * 100).toFixed(2)}%`, width - 14, 30);

    const lostShake = s.heartLostAge < 0.35 ? (1 - s.heartLostAge / 0.35) * 4 : 0;
    for (let i = 0; i < s.maxHearts; i++) {
      const { x, y } = this.heartPos(i);
      const sp = i < s.hearts ? this.heartOn : this.heartOff;
      const dx = lostShake ? (Math.random() * 2 - 1) * lostShake : 0;
      ctx.drawImage(sp.canvas, x - sp.width / 2 + dx, y - sp.height / 2, sp.width, sp.height);
    }

    if (s.slowRemaining >= 0) {
      const barW = Math.min(220, laneAreaWidth * 0.6);
      const x = centerX - barW / 2;
      const y = 52;
      ctx.fillStyle = 'rgba(0,240,255,0.15)';
      ctx.fillRect(x, y, barW, 6);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(x, y, barW * s.slowRemaining, 6);
      ctx.textAlign = 'center';
      ctx.font = `700 11px ${FONT}`;
      ctx.fillStyle = '#00f0ff';
      ctx.fillText('ЗАМЕДЛЕНИЕ', centerX, y + 16);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, 0, width, 3);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(0, 0, width * s.progress, 3);

    if (s.debug) {
      ctx.textAlign = 'left';
      ctx.font = `400 11px monospace`;
      ctx.fillStyle = s.debug.fps < 50 ? '#ff2bd6' : '#b6ff00';
      ctx.fillText(
        `${s.debug.fps} fps · worst ${s.debug.worstMs} ms · notes ${s.debug.visibleNotes} · particles ${this.particles.alive} · lanes ${this.current} · latency ${s.debug.latencyMs} ms · offset ${s.debug.offsetMs} ms · rate ${s.debug.rate.toFixed(2)} · t ${s.songTime.toFixed(3)}`,
        10,
        height - 14,
      );
    }
  }

  /** Overlay for countdown / pause / fail. */
  drawOverlayText(title: string, subtitle?: string, color = '#ffffff'): void {
    const ctx = this.ctx;
    const { width, height } = this.layout;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = 'rgba(5,6,10,0.55)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.min(64, width / 6)}px ${FONT}`;
    ctx.fillStyle = color;
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
