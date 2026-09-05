import { COMBO_THRESHOLDS, KEY_LABELS, LANE_COLORS, LANE_COUNT, MAX_LANES } from '@/shared/config/constants';
import { hexToRgba, renderBeam, renderGlowDot, renderHeart, renderNoteSprite, renderSpell, type NoteSprite } from '@/shared/lib/render';
import { ParticlePool, ScreenShake, LaneFlash } from '@/shared/lib/render';
import type { Judgement } from '@/entities/score';
import type { SpellKind } from '@/entities/chart';
import { NoteState, type NoteManager, type PooledNote } from '../model/NoteManager';
import { computeLayout, touchZoneRect, type Layout } from './layout';

/** FX budget: "low" halves particle emission and skips hold sparks, the bass zoom and milestone shockwaves (mid-range phones). */
export type FxLevel = 'full' | 'low';

export interface FrameState {
  songTime: number;
  approachTime: number;
  /** Audio-reactive pulse 0..1 — bass hits of the track itself, so every song flickers differently and in time. */
  pulse: number;
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
  /** Points awarded by the last judgement (for the "+300" popup). */
  lastGain: number;
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
const TRANSITION_SEC = 0.75;
const RING_POOL = 16;
const PRESS_BOUNCE_SEC = 0.12;
const POP_POOL = 8;

/** Everything that depends on the lane count: geometry, static layer, sized sprites. */
interface LaneSet {
  lanes: number;
  layout: Layout;
  staticLayer: HTMLCanvasElement | OffscreenCanvas;
  noteSprites: NoteSprite[];
  holdSprites: NoteSprite[];
  beams: NoteSprite[];
  spells: Record<SpellKind, NoteSprite>;
  /** Per-lane fill for the touched zone (touch devices), precomputed — no string building per frame. */
  zoneFill: string[];
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
  /** Field without dividers / receptors / labels — the canvas for the lane-morph transition. */
  private baseLayer!: HTMLCanvasElement | OffscreenCanvas;
  // Expanding rings on perfect hits / circle hits (SoA pool).
  private readonly ringX = new Float32Array(RING_POOL);
  private readonly ringY = new Float32Array(RING_POOL);
  private readonly ringAge = new Float32Array(RING_POOL).fill(1);
  private readonly ringColor = new Uint8Array(RING_POOL);
  private ringCursor = 0;
  // Receptor bounce per lane (seconds since press).
  private readonly pressAge = new Float32Array(MAX_LANES).fill(1);
  // Roll tap counter popups.
  private readonly popX = new Float32Array(POP_POOL);
  private readonly popY = new Float32Array(POP_POOL);
  private readonly popAge = new Float32Array(POP_POOL).fill(1);
  private readonly popText: string[] = new Array(POP_POOL).fill('');
  private popCursor = 0;
  private shockAge = 1;
  private bannerText = '';
  private bannerAge = 1;
  private sparkTimer = 0;
  readonly particles = new ParticlePool(300);
  readonly shake = new ScreenShake();
  readonly flash = new LaneFlash(MAX_LANES);
  visibleNotes = 0;
  private fxLevel: FxLevel = 'full';
  private fxAuto = false;
  /** Safe-area insets (notch / home indicator) read from CSS env() — the HUD keeps clear of them. */
  private safeTop = 0;
  private safeBottom = 0;

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

  /** Geometry for a given lane count (notes of other sections). */
  layoutFor(n: number): Layout {
    return this.set(n).layout;
  }

  private set(n: number): LaneSet {
    let s = this.sets.get(n);
    if (!s) {
      s = this.buildSet(n);
      this.sets.set(n, s);
    }
    return s;
  }

  /** Current FX budget (other effects gate themselves on this too). */
  get fx(): FxLevel {
    return this.fxLevel;
  }

  /** Switch the FX budget; `auto` marks a switch made by the FPS watchdog (shown in the debug overlay). */
  setFxLevel(level: FxLevel, auto = false): void {
    this.fxLevel = level;
    this.fxAuto = auto;
    this.particles.emitScale = level === 'low' ? 0.5 : 1;
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
    this.safeTop = readSafeInset('--safe-top');
    this.safeBottom = readSafeInset('--safe-bottom');
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.sets.clear();
    for (const n of this.laneCounts) this.sets.set(n, this.buildSet(n));
    this.baseLayer = this.buildStaticLayer(computeLayout(this.width, this.height, this.touch, LANE_COUNT), true);
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
    this.shake.trigger(2);
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
      zoneFill: colors.map((c) => hexToRgba(c, 0.12)),
    };
  }

  private buildStaticLayer(L: Layout, bare = false): HTMLCanvasElement | OffscreenCanvas {
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
    for (let i = 0; i <= lanes && !bare; i++) {
      const x = Math.round(laneX + i * laneWidth) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    if (this.touch && !bare) this.drawTouchZones(ctx, L);

    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(laneX, hitY - 1.5, laneAreaWidth, 3);
    ctx.shadowBlur = 0;
    for (let i = 0; i < lanes && !bare; i++) {
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

    if (!this.touch && !bare) {
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

  /**
   * Touch devices: the bottom half is the tap area (GDD §4). A faint wash of each lane's colour,
   * thin separators and a small bar at the bottom of every zone show where to tap; zones span the
   * full width (see `touchZoneRect`), which matters in landscape where the lanes are narrower.
   */
  private drawTouchZones(ctx: CanvasRenderingContext2D, L: Layout): void {
    const { lanes, height } = L;
    for (let i = 0; i < lanes; i++) {
      const z = touchZoneRect(L, i);
      const color = LANE_COLORS[i % LANE_COLORS.length];
      const wash = ctx.createLinearGradient(0, z.y, 0, height);
      wash.addColorStop(0, hexToRgba(color, 0));
      wash.addColorStop(1, hexToRgba(color, 0.09));
      ctx.fillStyle = wash;
      ctx.fillRect(z.x, z.y, z.width, z.height);
      // "Tap here" bar, clear of the home indicator.
      ctx.fillStyle = hexToRgba(color, 0.45);
      ctx.fillRect(z.x + z.width * 0.25, height - 6 - this.safeBottom, z.width * 0.5, 3);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    for (let i = 1; i < lanes; i++) {
      const x = Math.round(touchZoneRect(L, i).x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, L.touchZoneTop);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(0, Math.round(L.touchZoneTop) + 0.5);
    ctx.lineTo(L.width, Math.round(L.touchZoneTop) + 0.5);
    ctx.stroke();
  }

  /** Receptor bounce on every press. */
  pressFeedback(lane: number): void {
    if (lane >= 0 && lane < MAX_LANES) this.pressAge[lane] = 0;
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

  /** Extra tap on a roll: small burst + counter popup. */
  rollTap(lane: number, lanes: number, taps: number, needed: number): void {
    const L = this.set(lanes).layout;
    const cx = L.laneX + (lane + 0.5) * L.laneWidth;
    this.flash.trigger(lane);
    this.particles.emit(cx, L.hitY, 5, lane % LANE_COLORS.length, 220, 4, 0.35);
    this.pop(cx, L.hitY - L.noteHeight * 2.2, `${Math.min(taps, needed)}/${needed}`);
  }

  private ring(x: number, y: number, color: number): void {
    const i = this.ringCursor;
    this.ringCursor = (this.ringCursor + 1) % RING_POOL;
    this.ringX[i] = x;
    this.ringY[i] = y;
    this.ringAge[i] = 0;
    this.ringColor[i] = color;
  }

  private pop(x: number, y: number, text: string): void {
    const i = this.popCursor;
    this.popCursor = (this.popCursor + 1) % POP_POOL;
    this.popX[i] = x;
    this.popY[i] = y;
    this.popAge[i] = 0;
    this.popText[i] = text;
  }

  /** Catching a spell: a big burst in the spell's colour. */
  spellFeedback(lane: number, lanes: number, kind: SpellKind): void {
    const { laneX, laneWidth, hitY } = this.set(lanes).layout;
    const cx = laneX + (lane + 0.5) * laneWidth;
    this.particles.emit(cx, hitY, 40, kind === 'slow' ? 0 : 1, 460, 7, 0.9);
    this.shake.trigger(2);
  }

  comboMilestone(combo: number): void {
    this.shake.trigger(2.5);
    if (this.fxLevel === 'full') this.shockAge = 0;
    this.bannerText = `${combo} COMBO`;
    this.bannerAge = 0;
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
    for (let i = 0; i < POP_POOL; i++) if (this.popAge[i] < 1) this.popAge[i] += dt / 0.6;
    for (let i = 0; i < MAX_LANES; i++) if (this.pressAge[i] < 1) this.pressAge[i] += dt;
    if (this.shockAge < 1) this.shockAge += dt / 0.5;
    if (this.bannerAge < 1) this.bannerAge += dt / 1.1;
    this.sparkTimer += dt;
  }

  private heartPos(index: number): { x: number; y: number } {
    const step = this.heartSize * 1.25;
    return { x: 14 + this.heartSize / 2 + index * step, y: 50 + this.safeTop + this.heartSize / 2 };
  }

  draw(notes: NoteManager, s: FrameState): void {
    const ctx = this.ctx;
    const cur = this.set(this.current);
    const L = cur.layout;
    const { width, height, laneX, laneWidth, hitY } = L;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // Bass "camera punch": a tiny zoom around the centre on every hit of the track.
    const zoom = this.fxLevel === 'low' ? 1 : 1 + 0.012 * s.pulse;
    ctx.translate(width / 2 + this.shake.offsetX, height / 2 + this.shake.offsetY);
    ctx.scale(zoom, zoom);
    ctx.translate(-width / 2, -height / 2);

    // Static layer(s): cross-fade during a lane-count transition.
    const tr = this.transition;
    const trAge = tr ? (performance.now() / 1000 - tr.start) / TRANSITION_SEC : 1;
    if (tr && trAge < 1) {
      ctx.drawImage(this.baseLayer, 0, 0, width, height);
      this.drawLaneMorph(tr.from, tr.to, trAge);
      const settle = Math.max(0, (trAge - 0.72) / 0.28);
      if (settle > 0) {
        ctx.globalAlpha = settle;
        ctx.drawImage(cur.staticLayer, 0, 0, width, height);
        ctx.globalAlpha = 1;
      }
    } else {
      if (tr) {
        this.transition = null;
        this.lockIn();
      }
      ctx.drawImage(cur.staticLayer, 0, 0, width, height);
    }

    // Background pulse from the music's own bass hits; magenta palette + laser sweeps in choruses (5+ lanes).
    const pulse = s.pulse;
    const chorus = this.current >= 5;
    const energy = 0.035 + 0.015 * Math.max(0, this.current - 3);
    const slowTint = s.slowRemaining >= 0 ? 0.06 : 0;
    const alpha = energy * pulse + slowTint;
    if (alpha > 0.02) {
      ctx.fillStyle = chorus ? `rgba(255,43,214,${alpha.toFixed(3)})` : `rgba(0,240,255,${alpha.toFixed(3)})`;
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
      // Touch: the zone under the finger lights up too (the beam alone is above the finger).
      if (heldNow && this.touch) {
        const zw = width / this.current;
        ctx.fillStyle = cur.zoneFill[lane];
        ctx.fillRect(lane * zw, L.touchZoneTop, zw, height - L.touchZoneTop);
      }
    }

    // Receptors: light up with the bass, bounce on press.
    for (let lane = 0; lane < this.current; lane++) {
      const sp = cur.noteSprites[lane];
      const cx = laneX + (lane + 0.5) * laneWidth;
      const press = this.pressAge[lane] < PRESS_BOUNCE_SEC ? 1 - this.pressAge[lane] / PRESS_BOUNCE_SEC : 0;
      const a = Math.max(0.25 * pulse, 0.55 * press);
      if (a < 0.03) continue;
      const scale = 1 + 0.22 * press;
      ctx.globalAlpha = a;
      ctx.drawImage(sp.canvas, cx - (sp.width * scale) / 2, hitY - (sp.height * scale) / 2, sp.width * scale, sp.height * scale);
      ctx.globalAlpha = 1;
    }

    // Notes — each drawn in the geometry of its own section.
    const pxPerSec = hitY / s.approachTime;
    let visible = 0;
    const horizon = s.songTime + s.approachTime + 0.2;
    const spin = (s.songTime * 1.5) % (Math.PI * 2);
    const sparkTick = this.sparkTimer > 0.03;
    if (sparkTick) this.sparkTimer = 0;
    let prevCircle: PooledNote | null = null;
    let prevCircleSet: LaneSet | null = null;
    for (let i = notes.firstActive; i < notes.count; i++) {
      const n = notes.pool[i];
      if (n.time > horizon) break;
      if (n.state === NoteState.Hit || n.state === NoteState.Released) continue;
      const set = n.lanes === this.current ? cur : this.set(n.lanes);
      const lw = set.layout.laneWidth;
      const cx = set.layout.laneX + (n.lane + 0.5) * lw;
      if (n.kind === 'circle') {
        if (prevCircle && prevCircleSet && prevCircle.state === NoteState.Pending && n.seq === prevCircle.seq + 1) {
          this.drawFollowLine(prevCircleSet, prevCircle, set, n, s);
        }
        this.drawCircle(set, n, cx, s);
        prevCircle = n;
        prevCircleSet = set;
        visible++;
        continue;
      }
      const y = hitY - (n.time - s.songTime) * pxPerSec;
      if (n.duration > 0) {
        const yEnd = hitY - (n.endTime - s.songTime) * pxPerSec;
        if (n.kind === 'slide') this.drawSlideBody(set, n, cx, y, yEnd, s);
        else this.drawHoldBody(set, n, cx, y, yEnd, lw, height, s);
        if (n.state === NoteState.Holding) {
          // Sparks streaming from the receptor while a hold-type note is being held.
          if (sparkTick && this.fxLevel === 'full') {
            const hx = n.kind === 'slide' ? this.slideX(set, n, s.songTime) : cx;
            this.particles.emit(hx, hitY, 2, n.lane % LANE_COLORS.length, 160, 3, 0.3);
          }
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
        if (n.state === NoteState.Pending) {
          ctx.globalAlpha = 0.18;
          ctx.drawImage(sp.canvas, cx - sp.width / 2, y - sp.height / 2 - set.layout.noteHeight * 0.9, sp.width, sp.height);
          ctx.globalAlpha = 1;
        }
        ctx.drawImage(sp.canvas, cx - sp.width / 2, y - sp.height / 2, sp.width, sp.height);
        if (n.kind === 'roll') {
          ctx.font = `900 ${Math.round(set.layout.noteHeight * 0.9)}px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#05060a';
          ctx.fillText(`×${n.extra}`, cx, y + 1);
        }
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

    // Roll counters.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < POP_POOL; i++) {
      const a = this.popAge[i];
      if (a >= 1) continue;
      ctx.globalAlpha = 1 - a;
      ctx.font = `900 16px ${FONT}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(this.popText[i], this.popX[i], this.popY[i] - a * 30);
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

    if (tr && trAge < 1) this.drawTransitionFx(tr.from, tr.to, trAge);
    this.drawHud(s);
  }

  private slideX(set: LaneSet, n: PooledNote, songTime: number): number {
    const L = set.layout;
    const t = Math.max(0, Math.min(1, (songTime - n.time) / Math.max(1e-6, n.duration)));
    const x0 = L.laneX + (n.lane + 0.5) * L.laneWidth;
    const x1 = L.laneX + (n.extra + 0.5) * L.laneWidth;
    return x0 + (x1 - x0) * t;
  }

  private drawHoldBody(set: LaneSet, n: PooledNote, cx: number, y: number, yEnd: number, lw: number, height: number, s: FrameState): void {
    const ctx = this.ctx;
    const top = Math.max(-40, yEnd);
    const bottom = n.state === NoteState.Holding ? set.layout.hitY : Math.min(height + 40, y);
    if (bottom <= top) return;
    const color = LANE_COLORS[n.lane % LANE_COLORS.length];
    ctx.globalAlpha = n.state === NoteState.Missed ? 0.25 : 0.55;
    ctx.fillStyle = color;
    if (n.kind === 'roll') {
      // Striped body: one stripe per required tap.
      const stripes = Math.max(2, n.extra);
      const h = (bottom - top) / stripes;
      for (let k = 0; k < stripes; k++) {
        ctx.globalAlpha = (k % 2 ? 0.3 : 0.6) * (n.state === NoteState.Missed ? 0.4 : 1);
        ctx.fillRect(cx - lw * 0.22, top + k * h + 1, lw * 0.44, Math.max(1, h - 2));
      }
      if (n.state === NoteState.Holding) {
        ctx.globalAlpha = 1;
        ctx.font = `900 ${Math.round(set.layout.noteHeight * 0.8)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${Math.min(n.taps, n.extra)}/${n.extra}`, cx, set.layout.hitY - set.layout.noteHeight * 2.2 + Math.sin(s.songTime * 20) * 2);
      }
    } else {
      ctx.fillRect(cx - lw * 0.18, top, lw * 0.36, bottom - top);
    }
    ctx.globalAlpha = 1;
    const hs = set.holdSprites[n.lane];
    ctx.drawImage(hs.canvas, cx - hs.width / 2, yEnd - hs.height / 2, hs.width, hs.height);
  }

  private drawSlideBody(set: LaneSet, n: PooledNote, cx: number, y: number, yEnd: number, s: FrameState): void {
    const ctx = this.ctx;
    const L = set.layout;
    const x1 = L.laneX + (n.extra + 0.5) * L.laneWidth;
    const w = L.laneWidth * 0.2;
    const color = LANE_COLORS[n.lane % LANE_COLORS.length];
    const endColor = LANE_COLORS[n.extra % LANE_COLORS.length];
    const grad = ctx.createLinearGradient(cx, y, x1, yEnd);
    grad.addColorStop(0, hexToRgba(color, 0.6));
    grad.addColorStop(1, hexToRgba(endColor, 0.6));
    ctx.globalAlpha = n.state === NoteState.Missed ? 0.25 : 1;
    ctx.fillStyle = grad;
    // Clip the body at the hit line while holding (the part already travelled is gone).
    const yStart = n.state === NoteState.Holding ? L.hitY : y;
    const xStart = n.state === NoteState.Holding ? this.slideX(set, n, s.songTime) : cx;
    ctx.beginPath();
    ctx.moveTo(xStart - w, yStart);
    ctx.lineTo(xStart + w, yStart);
    ctx.lineTo(x1 + w, yEnd);
    ctx.lineTo(x1 - w, yEnd);
    ctx.closePath();
    ctx.fill();
    // Direction chevrons.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    const dx = x1 - xStart;
    const dy = yEnd - yStart;
    const len = Math.hypot(dx, dy) || 1;
    const steps = Math.max(1, Math.floor(len / 28));
    for (let k = 1; k <= steps; k++) {
      const px = xStart + (dx * k) / (steps + 1);
      const py = yStart + (dy * k) / (steps + 1);
      const ux = dx / len;
      const uy = dy / len;
      ctx.beginPath();
      ctx.moveTo(px - ux * 6 + uy * 5, py - uy * 6 - ux * 5);
      ctx.lineTo(px, py);
      ctx.lineTo(px - ux * 6 - uy * 5, py - uy * 6 + ux * 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const hs = set.holdSprites[n.extra];
    ctx.drawImage(hs.canvas, x1 - hs.width / 2, yEnd - hs.height / 2, hs.width, hs.height);
    if (n.state === NoteState.Holding) {
      // The finger marker: where the slide currently is on the hit line.
      const dot = this.glowDots[n.lane % LANE_COLORS.length];
      ctx.drawImage(dot.canvas, xStart - 18, L.hitY - 18, 36, 36);
    }
  }

  private drawFollowLine(setA: LaneSet, a: PooledNote, setB: LaneSet, b: PooledNote, s: FrameState): void {
    if (b.time - s.songTime > s.approachTime) return;
    const ctx = this.ctx;
    const ax = setA.layout.laneX + (a.lane + 0.5) * setA.layout.laneWidth;
    const ay = circleY(setA.layout, a.seq);
    const bx = setB.layout.laneX + (b.lane + 0.5) * setB.layout.laneWidth;
    const by = circleY(setB.layout, b.seq);
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  /**
   * osu!-style hit circle: sits still at a fixed height in its lane while an approach ring shrinks
   * onto it. Tap (or press Space) when the ring meets the circle. Numbered within its group.
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

  /** Lane-count change, part 1: a short white flash and the new count fading in above the field. */
  private drawTransitionFx(from: number, to: number, t: number): void {
    const ctx = this.ctx;
    const { width, height } = this.layout;
    if (t < 0.12) {
      const { laneX, laneAreaWidth } = this.layout;
      ctx.fillStyle = `rgba(255,255,255,${(0.16 * (1 - t / 0.12)).toFixed(3)})`;
      ctx.fillRect(laneX, 0, laneAreaWidth, height);
    }
    const pop = Math.min(1, t / 0.3);
    const scale = 1.45 - 0.45 * (1 - (1 - pop) ** 3);
    const alpha = Math.min(1, pop * 1.5) * (1 - Math.max(0, t - 0.75) / 0.25);
    const color = to >= 5 ? '#ff2bd6' : '#00f0ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = alpha;
    ctx.font = `900 ${Math.round(58 * scale)}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 28;
    ctx.fillText(String(to), width / 2, height * 0.3);
    ctx.shadowBlur = 0;
    ctx.font = `400 13px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(`${to >= 5 ? 'ПОЛОС' : 'ПОЛОСЫ'} · ${to > from ? 'ШИРЕ' : 'УЖЕ'}`, width / 2, height * 0.3 + 40 * scale);
    ctx.globalAlpha = 1;
  }

  /**
   * Lane-count change, part 2: dividers and receptors physically slide to their new places —
   * lanes split apart or merge, with a slight overshoot and light trails while they move.
   * The new geometry's static layer fades in over the last quarter of the transition.
   */
  private drawLaneMorph(from: number, to: number, t: number): void {
    const ctx = this.ctx;
    const L = this.layout;
    const { laneX, laneAreaWidth: W, hitY, height, noteHeight } = L;
    const u = Math.min(1, t / 0.72);
    const k = 0.7;
    const e = 1 + (k + 1) * (u - 1) ** 3 + k * (u - 1) ** 2; // ease-out-back
    const fadeOld = Math.max(0, 1 - t / 0.45);
    const fadeNew = Math.min(1, t / 0.45);
    const trail = Math.sin(Math.PI * u);
    const wOld = W / from;
    const wNew = W / to;

    const divider = (x: number, alpha: number) => {
      if (alpha <= 0.02) return;
      if (trail > 0.05) {
        ctx.globalAlpha = alpha * 0.35 * trail;
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    };
    // Old dividers converge on the nearest new one; new ones emerge from the nearest old one.
    for (let i = 1; i < from; i++) {
      const x0 = laneX + (i / from) * W;
      const x1 = laneX + (Math.round((i * to) / from) / to) * W;
      divider(x0 + (x1 - x0) * e, fadeOld);
    }
    for (let j = 1; j < to; j++) {
      const x1 = laneX + (j / to) * W;
      const x0 = laneX + (Math.round((j * from) / to) / from) * W;
      divider(x0 + (x1 - x0) * e, fadeNew);
    }

    const pill = (cx: number, w: number, color: string, alpha: number) => {
      if (alpha <= 0.02) return;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = hexToRgba(color, 0.75);
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14 + 10 * trail;
      roundRect(ctx, cx - w * 0.41, hitY - noteHeight / 2, w * 0.82, noteHeight, noteHeight / 2.4);
      ctx.stroke();
    };
    for (let i = 0; i < from; i++) {
      const c0 = laneX + (i + 0.5) * wOld;
      const j = Math.min(to - 1, Math.max(0, Math.round(((i + 0.5) * to) / from - 0.5)));
      const c1 = laneX + (j + 0.5) * wNew;
      pill(c0 + (c1 - c0) * e, wOld + (wNew - wOld) * e, LANE_COLORS[i % LANE_COLORS.length], fadeOld);
    }
    for (let j = 0; j < to; j++) {
      const c1 = laneX + (j + 0.5) * wNew;
      const i = Math.min(from - 1, Math.max(0, Math.round(((j + 0.5) * from) / to - 0.5)));
      const c0 = laneX + (i + 0.5) * wOld;
      pill(c0 + (c1 - c0) * e, wOld + (wNew - wOld) * e, LANE_COLORS[j % LANE_COLORS.length], fadeNew);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  /** The lanes have locked into place: every receptor bursts once. */
  private lockIn(): void {
    const { laneX, laneWidth, hitY, lanes } = this.layout;
    for (let i = 0; i < lanes; i++) {
      this.particles.emit(laneX + (i + 0.5) * laneWidth, hitY, 9, i % LANE_COLORS.length, 320, 5, 0.6);
      this.flash.trigger(i);
    }
    this.shake.trigger(1.5);
  }

  private drawHud(s: FrameState): void {
    const ctx = this.ctx;
    const { width, height, laneX, laneAreaWidth, hitY, portrait } = this.layout;
    const centerX = laneX + laneAreaWidth / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Combo: font scales with combo, colour by threshold, pops on every hit and trembles from 20.
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

    // Judgement + points popup.
    if (s.lastJudgement && s.lastJudgementAge < 0.5) {
      const a = 1 - s.lastJudgementAge / 0.5;
      const scale = 1 + (1 - Math.min(1, s.lastJudgementAge / 0.08)) * 0.35;
      ctx.font = `700 ${Math.round(22 * scale)}px ${FONT}`;
      ctx.fillStyle = JUDGEMENT_COLOR[s.lastJudgement];
      ctx.globalAlpha = a;
      ctx.fillText(s.lastJudgement.toUpperCase(), centerX, hitY * 0.62);
      if (s.lastGain > 0) {
        ctx.font = `700 14px ${FONT}`;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(`+${s.lastGain}`, centerX, hitY * 0.62 + 22 - s.lastJudgementAge * 30);
      }
      ctx.globalAlpha = 1;
    }

    // Milestone banner sliding through.
    if (this.bannerAge < 1) {
      const a = this.bannerAge;
      const ease = a < 0.2 ? 1 - (1 - a / 0.2) ** 3 : a > 0.8 ? (1 - a) / 0.2 : 1;
      const x = width * (1.2 - 0.7 * Math.min(1, a / 0.2)) - (a > 0.8 ? (a - 0.8) * width : 0);
      ctx.globalAlpha = Math.max(0, Math.min(1, ease));
      ctx.font = `900 ${portrait ? 26 : 34}px ${FONT}`;
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center';
      ctx.fillText(this.bannerText, Math.min(width / 2, x), hitY * 0.2);
      ctx.globalAlpha = 1;
    }

    ctx.font = `700 ${portrait ? 18 : 22}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    const hudY = 30 + this.safeTop;
    ctx.fillText(s.score.toLocaleString('ru-RU'), 14, hudY);
    ctx.textAlign = 'right';
    ctx.fillStyle = s.accuracy >= 0.95 ? '#ffd700' : 'rgba(255,255,255,0.85)';
    ctx.fillText(`${(s.accuracy * 100).toFixed(2)}%`, width - 14, hudY);

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
      const y = 52 + this.safeTop;
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
    ctx.fillRect(0, this.safeTop, width, 3);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(0, this.safeTop, width * s.progress, 3);

    if (s.debug) {
      ctx.textAlign = 'left';
      ctx.font = `400 11px monospace`;
      ctx.fillStyle = s.debug.fps < 50 ? '#ff2bd6' : '#b6ff00';
      ctx.fillText(
        `${s.debug.fps} fps · worst ${s.debug.worstMs} ms · notes ${s.debug.visibleNotes} · particles ${this.particles.alive} · lanes ${this.current} · fx ${this.fxLevel}${this.fxAuto ? '·auto' : ''} · latency ${s.debug.latencyMs} ms · offset ${s.debug.offsetMs} ms · rate ${s.debug.rate.toFixed(2)} · t ${s.songTime.toFixed(3)}`,
        10,
        height - 14 - this.safeBottom,
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

/** Reads a CSS custom property holding an env(safe-area-inset-*) value, in px (0 when unsupported). */
function readSafeInset(prop: string): number {
  if (typeof document === 'undefined') return 0;
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(prop));
  return Number.isFinite(v) && v > 0 ? Math.min(v, 120) : 0;
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
