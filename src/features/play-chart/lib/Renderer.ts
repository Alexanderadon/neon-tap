import { COMBO_THRESHOLDS, KEY_LABELS, LANE_COUNT, MAX_LANES } from '@/shared/config/constants';
import { SPECTRUM_BANDS } from '@/shared/lib/audio';
import {
  DEFAULT_THEME,
  goodJudgementColor,
  hexToRgba,
  renderBeam,
  renderGlowBar,
  renderGlowDot,
  renderGlowRing,
  renderHeart,
  renderNoteSprite,
  renderSpell,
  type NoteSprite,
  type Theme,
} from '@/shared/lib/render';
import { ParticlePool, ScreenShake, LaneFlash } from '@/shared/lib/render';
import type { Judgement } from '@/entities/score';
import type { SpellKind } from '@/entities/chart';
import { NoteState, type NoteManager, type PooledNote } from '../model/NoteManager';
import { computeLayout, type Layout } from './layout';

export interface FrameState {
  songTime: number;
  approachTime: number;
  /** Audio-reactive pulse 0..1 — bass hits of the track itself, so every song flickers differently and in time. */
  pulse: number;
  /** 0 on a beat → 1 just before the next one (beat-rate scrolling of the ambient layer). */
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
  /** Points awarded by the last judgement (for the "+300" popup). */
  lastGain: number;
  comboBreakAge: number;
  debug: { fps: number; worstMs: number; latencyMs: number; visibleNotes: number; offsetMs: number; rate: number } | null;
}

/** Heavy-effect budget: "low" skips the music-synchronised background (beat pulses, equaliser, ambient motif). */
export type FxLevel = 'full' | 'low';

const FONT = "'Unbounded', 'Segoe UI', system-ui, sans-serif";
const HEART_COLOR = '#ff2bd6';
const TRANSITION_SEC = 0.75;
const RING_POOL = 16;
const PRESS_BOUNCE_SEC = 0.12;
const POP_POOL = 8;
/** Beat pulse: ring + horizon flash decay over this long. */
const BEAT_SEC = 0.3;
/** Equaliser smoothing (per second): fast attack, slow release. */
const SPECTRUM_ATTACK = 28;
const SPECTRUM_RELEASE = 5;
const SPECTRUM_MAX_ALPHA = 0.35;
const RING_SPRITE_RADIUS = 64;
const HAZE_RADIUS = 96;
const GRID_LINES = 7;
const AMBIENT_RINGS = 3;

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
 *
 * Colours come from a `Theme` (per-track): lane colours for sprites / receptors / beams /
 * particles, the background gradient of the static layer, and the HUD accent. The
 * music-synchronised background (beat pulses, spectrum skyline, ambient motif) is gated by
 * `fxLevel` and uses only predrawn sprites and solid fills — no gradients or blur per frame.
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

  // --- theme / feel ---
  readonly theme: Theme;
  /** Heavy-effect budget; every music-synchronised background effect checks this. */
  fxLevel: FxLevel = 'full';
  /** Lane colour per lane index (theme palette wrapped to MAX_LANES). */
  private readonly laneColors: string[];
  private readonly judgementColor: Record<Judgement, string>;
  /** Dark disc / text colour taken from the theme background. */
  private readonly inkColor: string;
  private readonly discColor: string;
  // Beat pulse (ring + horizon flash), fed by beatFeedback().
  private beatAge = 1;
  private beatStrength = 0;
  // Spectrum skyline: smoothed band levels 0..1.
  private readonly bands = new Float32Array(SPECTRUM_BANDS);
  private spectrumLive = false;
  private ambientTime = 0;
  // Sized sprites for the background layer (rebuilt on resize).
  private barAccent!: NoteSprite;
  private barGlow!: NoteSprite;
  private ringAccent!: NoteSprite;
  private ringGlow!: NoteSprite;
  private hazeAccent!: NoteSprite;
  private hazeGlow!: NoteSprite;
  private barW = 8;
  private barMaxH = 100;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private touch: boolean,
    laneCounts: readonly number[] = [LANE_COUNT],
    theme: Theme = DEFAULT_THEME,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
    this.laneCounts = [...new Set([...laneCounts, LANE_COUNT])];
    this.theme = theme;
    this.laneColors = Array.from({ length: MAX_LANES }, (_, i) => theme.laneColors[i % theme.laneColors.length]);
    // GOOD must never be white (PERFECT is), so themes with a white lane fall back to another lane colour.
    this.judgementColor = { perfect: '#ffffff', great: theme.accent, good: goodJudgementColor(theme), miss: theme.glow };
    this.inkColor = theme.bg[0];
    this.discColor = hexToRgba(theme.bg[1], 0.92);
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

  setTouch(touch: boolean): void {
    if (this.touch === touch) return;
    this.touch = touch;
    this.resize();
  }

  setFxLevel(level: FxLevel): void {
    this.fxLevel = level;
    if (level !== 'full') {
      this.beatAge = 1;
      this.bands.fill(0);
      this.spectrumLive = false;
    }
  }

  resize(): void {
    this.width = this.canvas.clientWidth || window.innerWidth;
    this.height = this.canvas.clientHeight || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.sets.clear();
    for (const n of this.laneCounts) this.sets.set(n, this.buildSet(n));
    const base = computeLayout(this.width, this.height, this.touch, LANE_COUNT);
    this.baseLayer = this.buildStaticLayer(base, true);
    this.glowDots = this.laneColors.map((c) => renderGlowDot(c, 16, this.dpr));
    this.heartSize = this.height > this.width ? 16 : 20;
    this.heartOn = renderHeart(HEART_COLOR, this.heartSize, this.dpr, true);
    this.heartOff = renderHeart(HEART_COLOR, this.heartSize, this.dpr, false);
    // Background layer sprites — sized once here, only scaled with drawImage per frame.
    const { accent, glow } = this.theme;
    this.barW = base.laneAreaWidth / SPECTRUM_BANDS;
    this.barMaxH = base.hitY * 0.6;
    this.barAccent = renderGlowBar(accent, this.barW, this.barMaxH, this.dpr);
    this.barGlow = renderGlowBar(glow, this.barW, this.barMaxH, this.dpr);
    this.ringAccent = renderGlowRing(accent, RING_SPRITE_RADIUS, this.dpr);
    this.ringGlow = renderGlowRing(glow, RING_SPRITE_RADIUS, this.dpr);
    this.hazeAccent = renderGlowDot(accent, HAZE_RADIUS, this.dpr);
    this.hazeGlow = renderGlowDot(glow, HAZE_RADIUS, this.dpr);
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
    const colors = Array.from({ length: n }, (_, i) => this.laneColors[i % this.laneColors.length]);
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
    // Theme background: top → bottom gradient (the default theme is flat near-black).
    const [top, bottom] = this.theme.bg;
    if (top === bottom) {
      ctx.fillStyle = top;
    } else {
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, top);
      bg.addColorStop(1, bottom);
      ctx.fillStyle = bg;
    }
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

    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(laneX, hitY - 1.5, laneAreaWidth, 3);
    ctx.shadowBlur = 0;
    for (let i = 0; i < lanes && !bare; i++) {
      const cx = laneX + (i + 0.5) * laneWidth;
      const color = this.laneColors[i % this.laneColors.length];
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

  /** Receptor bounce on every press. */
  pressFeedback(lane: number): void {
    if (lane >= 0 && lane < MAX_LANES) this.pressAge[lane] = 0;
  }

  /**
   * A beat of the track just passed (`strength` 0..1, downbeats stronger): expanding ring and a
   * horizon flash behind the lanes, decaying over ~300 ms. Ignored on the low FX level.
   */
  beatFeedback(strength: number): void {
    if (this.fxLevel !== 'full' || strength <= 0) return;
    const remaining = this.beatAge < 1 ? this.beatStrength * (1 - this.beatAge) : 0;
    this.beatStrength = Math.min(1, Math.max(strength, remaining));
    this.beatAge = 0;
  }

  /**
   * Feed this frame's spectrum bands (0..255, `SPECTRUM_BANDS` of them). Smoothed here with a fast
   * attack / slow release so the skyline breathes instead of jittering. Ignored on the low FX level.
   */
  feedSpectrum(bands: Uint8Array, dt: number): void {
    if (this.fxLevel !== 'full') return;
    const n = Math.min(bands.length, SPECTRUM_BANDS);
    const up = Math.min(1, dt * SPECTRUM_ATTACK);
    const down = Math.min(1, dt * SPECTRUM_RELEASE);
    const s = this.bands;
    for (let i = 0; i < n; i++) {
      // Highs are quieter in bytes than lows: tilt them up so the skyline has a silhouette.
      let v = (bands[i] / 255) * (1 + (i / SPECTRUM_BANDS) * 0.9);
      if (v > 1) v = 1;
      const cur = s[i];
      s[i] = cur + (v - cur) * (v > cur ? up : down);
    }
    this.spectrumLive = true;
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
    const color = lane % this.laneColors.length;
    const count = (judgement === 'perfect' ? 10 : judgement === 'great' ? 7 : 4) * (circleSeq > 0 ? 3 : 1);
    this.particles.emit(cx, y, count, color, circleSeq > 0 ? 380 : 260, 5, 0.45);
    if (judgement === 'perfect' || circleSeq > 0) this.ring(cx, y, color);
  }

  /** Extra tap on a roll: small burst + counter popup. */
  rollTap(lane: number, lanes: number, taps: number, needed: number): void {
    const L = this.set(lanes).layout;
    const cx = L.laneX + (lane + 0.5) * L.laneWidth;
    this.flash.trigger(lane);
    this.particles.emit(cx, L.hitY, 5, lane % this.laneColors.length, 220, 4, 0.35);
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
    this.shockAge = 0;
    this.bannerText = `${combo} COMBO`;
    this.bannerAge = 0;
    const { laneX, laneWidth, hitY, lanes } = this.layout;
    for (let i = 0; i < lanes; i++) this.particles.emit(laneX + (i + 0.5) * laneWidth, hitY, 12, i % this.laneColors.length, 420, 6, 0.8);
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
    if (this.beatAge < 1) this.beatAge += dt / BEAT_SEC;
    this.sparkTimer += dt;
    this.ambientTime += dt;
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
    // Bass "camera punch": a tiny zoom around the centre on every hit of the track.
    const zoom = 1 + 0.012 * s.pulse;
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

    // Music-synchronised background: ambient motif, spectrum skyline, beat pulse (all behind the notes).
    if (this.fxLevel === 'full') {
      this.drawAmbient(L, s);
      if (this.spectrumLive) this.drawSpectrum(L);
      if (this.beatAge < 1) this.drawBeatPulse(L);
    }

    // Background pulse from the music's own bass hits; glow palette + laser sweeps in choruses (5+ lanes).
    const pulse = s.pulse;
    const chorus = this.current >= 5;
    const energy = 0.035 + 0.015 * Math.max(0, this.current - 3);
    const slowTint = s.slowRemaining >= 0 ? 0.06 : 0;
    const alpha = energy * pulse + slowTint;
    if (alpha > 0.02) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = chorus ? this.theme.glow : this.theme.accent;
      ctx.fillRect(laneX, 0, L.laneAreaWidth, height);
      ctx.globalAlpha = 1;
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
          if (sparkTick) {
            const hx = n.kind === 'slide' ? this.slideX(set, n, s.songTime) : cx;
            this.particles.emit(hx, hitY, 2, n.lane % this.laneColors.length, 160, 3, 0.3);
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
          ctx.fillStyle = this.inkColor;
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
      ctx.strokeStyle = this.laneColors[this.ringColor[i]];
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
      const dot = this.glowDots[p.color[i] % this.glowDots.length];
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

  // --- music-synchronised background -------------------------------------------------------

  /** Beat pulse: a ring expanding from the hit line plus a horizon flash under it, ~300 ms. */
  private drawBeatPulse(L: Layout): void {
    const ctx = this.ctx;
    const { laneX, laneAreaWidth, hitY } = L;
    const a = this.beatAge;
    const k = this.beatStrength * (1 - a);
    if (k <= 0.01) return;
    const cx = laneX + laneAreaWidth / 2;
    // Horizon flash: a band under the hit line that thins out as it fades.
    ctx.globalAlpha = 0.28 * k;
    ctx.fillStyle = this.beatStrength >= 1 ? this.theme.glow : this.theme.accent;
    const band = 4 + 26 * this.beatStrength * (1 - a);
    ctx.fillRect(laneX, hitY - band * 0.35, laneAreaWidth, band);
    // Ring: ease-out expansion from a fifth of the field to almost its full width.
    const e = 1 - (1 - a) * (1 - a);
    const size = laneAreaWidth * (0.2 + 0.75 * e);
    const sp = this.beatStrength >= 1 ? this.ringGlow : this.ringAccent;
    ctx.globalAlpha = SPECTRUM_MAX_ALPHA * k;
    ctx.drawImage(sp.canvas, cx - size / 2, hitY - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  /** Spectrum skyline: 32 mirrored bars rising from the hit line, bass in the middle, alpha ≤ 0.35. */
  private drawSpectrum(L: Layout): void {
    const ctx = this.ctx;
    const { laneX, hitY } = L;
    const w = this.barW;
    const maxH = this.barMaxH;
    const half = SPECTRUM_BANDS / 2;
    for (let j = 0; j < SPECTRUM_BANDS; j++) {
      // Left half takes the even bands (outer = highs), right half the odd ones: a near-symmetric skyline.
      const band = j < half ? (half - 1 - j) * 2 : (j - half) * 2 + 1;
      const v = this.bands[band];
      if (v < 0.03) continue;
      const h = maxH * v;
      const sp = Math.abs(j - (half - 0.5)) > half - 6 ? this.barGlow : this.barAccent;
      ctx.globalAlpha = SPECTRUM_MAX_ALPHA * (0.35 + 0.65 * v);
      ctx.drawImage(sp.canvas, laneX + j * w, hitY - h, w, h);
    }
    ctx.globalAlpha = 1;
  }

  /** Ambient layer per theme motif — a handful of fills / blits, all from cached sprites. */
  private drawAmbient(L: Layout, s: FrameState): void {
    const ctx = this.ctx;
    const { laneX, laneAreaWidth, hitY, height } = L;
    const t = this.ambientTime;
    const cx = laneX + laneAreaWidth / 2;
    switch (this.theme.motif) {
      case 'grid': {
        // Synthwave floor: horizon lines rolling towards the viewer, one slot per beat.
        ctx.strokeStyle = this.theme.accent;
        ctx.lineWidth = 1;
        const phase = s.beatPhase;
        for (let k = 0; k < GRID_LINES; k++) {
          const u = (k + phase) / GRID_LINES;
          const y = Math.round(hitY + (height - hitY) * u * u) + 0.5;
          ctx.globalAlpha = 0.05 + 0.13 * u;
          ctx.beginPath();
          ctx.moveTo(laneX, y);
          ctx.lineTo(laneX + laneAreaWidth, y);
          ctx.stroke();
        }
        break;
      }
      case 'rings': {
        // Slow concentric pulses drifting outwards from the upper field.
        const cy = hitY * 0.45;
        for (let k = 0; k < AMBIENT_RINGS; k++) {
          const u = (t / 4.5 + k / AMBIENT_RINGS) % 1;
          const size = laneAreaWidth * (0.15 + 0.95 * u);
          const sp = k % 2 ? this.ringAccent : this.ringGlow;
          ctx.globalAlpha = 0.16 * (1 - u) * (0.7 + 0.3 * s.pulse);
          ctx.drawImage(sp.canvas, cx - size / 2, cy - size / 2, size, size);
        }
        break;
      }
      case 'bars': {
        // Light shafts sweeping across the field.
        const w = laneAreaWidth * 0.14;
        for (let k = 0; k < 3; k++) {
          const x = cx + laneAreaWidth * 0.42 * Math.sin(t * 0.23 + k * 2.1);
          const sp = k % 2 ? this.barGlow : this.barAccent;
          ctx.globalAlpha = 0.09 + 0.05 * s.pulse;
          ctx.drawImage(sp.canvas, x - w / 2, 0, w, hitY);
        }
        break;
      }
      case 'haze': {
        // Soft colour blobs drifting slowly behind the field.
        for (let k = 0; k < 3; k++) {
          const x = cx + laneAreaWidth * 0.35 * Math.sin(t * 0.13 + k * 2.0);
          const y = hitY * (0.38 + 0.26 * Math.cos(t * 0.11 + k * 1.7));
          const size = laneAreaWidth * (0.6 + 0.12 * Math.sin(t * 0.2 + k));
          const sp = k % 2 ? this.hazeAccent : this.hazeGlow;
          ctx.globalAlpha = 0.11 + 0.05 * s.pulse;
          ctx.drawImage(sp.canvas, x - size / 2, y - size / 2, size, size);
        }
        break;
      }
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------------------------------

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
    const color = this.laneColors[n.lane % this.laneColors.length];
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
    const color = this.laneColors[n.lane % this.laneColors.length];
    const endColor = this.laneColors[n.extra % this.laneColors.length];
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
      const dot = this.glowDots[n.lane % this.laneColors.length];
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
    const color = this.laneColors[n.lane % this.laneColors.length];
    const missed = n.state === NoteState.Missed;
    const fade = dt < 0 ? Math.max(0, 1 + dt / 0.4) : 1;
    const base = (missed ? 0.3 : 1) * fade;
    ctx.globalAlpha = base;
    const dot = this.glowDots[n.lane % this.laneColors.length];
    ctx.drawImage(dot.canvas, cx - r * 1.6, cy - r * 1.6, r * 3.2, r * 3.2);
    ctx.fillStyle = this.discColor;
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
      ctx.globalAlpha = 0.16 * (1 - t / 0.12);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(laneX, 0, laneAreaWidth, height);
      ctx.globalAlpha = 1;
    }
    const pop = Math.min(1, t / 0.3);
    const scale = 1.45 - 0.45 * (1 - (1 - pop) ** 3);
    const alpha = Math.min(1, pop * 1.5) * (1 - Math.max(0, t - 0.75) / 0.25);
    const color = to >= 5 ? this.theme.glow : this.theme.accent;
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
        ctx.strokeStyle = this.theme.accent;
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
      pill(c0 + (c1 - c0) * e, wOld + (wNew - wOld) * e, this.laneColors[i % this.laneColors.length], fadeOld);
    }
    for (let j = 0; j < to; j++) {
      const c1 = laneX + (j + 0.5) * wNew;
      const i = Math.min(from - 1, Math.max(0, Math.round(((j + 0.5) * from) / to - 0.5)));
      const c0 = laneX + (i + 0.5) * wOld;
      pill(c0 + (c1 - c0) * e, wOld + (wNew - wOld) * e, this.laneColors[j % this.laneColors.length], fadeNew);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  /** The lanes have locked into place: every receptor bursts once. */
  private lockIn(): void {
    const { laneX, laneWidth, hitY, lanes } = this.layout;
    for (let i = 0; i < lanes; i++) {
      this.particles.emit(laneX + (i + 0.5) * laneWidth, hitY, 9, i % this.laneColors.length, 320, 5, 0.6);
      this.flash.trigger(i);
    }
    this.shake.trigger(1.5);
  }

  private drawHud(s: FrameState): void {
    const ctx = this.ctx;
    const { width, height, laneX, laneAreaWidth, hitY, portrait } = this.layout;
    const { accent, glow } = this.theme;
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
      ctx.globalAlpha = 1 - s.comboBreakAge / 0.4;
      ctx.fillStyle = glow;
      ctx.fillText('×', centerX, hitY * 0.42);
      ctx.globalAlpha = 1;
    }

    // Judgement + points popup.
    if (s.lastJudgement && s.lastJudgementAge < 0.5) {
      const a = 1 - s.lastJudgementAge / 0.5;
      const scale = 1 + (1 - Math.min(1, s.lastJudgementAge / 0.08)) * 0.35;
      ctx.font = `700 ${Math.round(22 * scale)}px ${FONT}`;
      ctx.fillStyle = this.judgementColor[s.lastJudgement];
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
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(x, y, barW, 6);
      ctx.globalAlpha = 1;
      ctx.fillRect(x, y, barW * s.slowRemaining, 6);
      ctx.textAlign = 'center';
      ctx.font = `700 11px ${FONT}`;
      ctx.fillText('ЗАМЕДЛЕНИЕ', centerX, y + 16);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, 0, width, 3);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, width * s.progress, 3);

    if (s.debug) {
      ctx.textAlign = 'left';
      ctx.font = `400 11px monospace`;
      ctx.fillStyle = s.debug.fps < 50 ? '#ff2bd6' : '#b6ff00';
      ctx.fillText(
        `${s.debug.fps} fps · worst ${s.debug.worstMs} ms · notes ${s.debug.visibleNotes} · particles ${this.particles.alive} · lanes ${this.current} · latency ${s.debug.latencyMs} ms · offset ${s.debug.offsetMs} ms · rate ${s.debug.rate.toFixed(2)} · t ${s.songTime.toFixed(3)} · fx ${this.fxLevel} · theme ${this.theme.id}`,
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
