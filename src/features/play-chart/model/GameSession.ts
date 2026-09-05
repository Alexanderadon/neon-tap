import { CIRCLE_BUCKET, CIRCLE_KEY, KEY_LAYOUTS, MAX_LANES } from '@/shared/config/constants';
import { audioEngine, BeatCursor, Clock, SPECTRUM_BANDS, sfxComboBreak, sfxHit, sfxLanes, sfxMilestone, sfxMiss, sfxRank } from '@/shared/lib/audio';
import { Input } from '@/shared/lib/input/Input';
import { clamp, lowerBound, median } from '@/shared/lib/math';
import { FpsMeter, LowFpsDetector, themeFor } from '@/shared/lib/render';
import type { ChartFile } from '@/shared/types/chart';
import type { PlayResult } from '@/shared/types/result';
import { countJudgements, parseChartLevel, parseSections, type Section, type SpellKind } from '@/entities/chart';
import type { FxMode } from '@/entities/settings';
import { Scoring, notesToReach, type Judgement } from '@/entities/score';
import { NoteManager, NoteState, type JudgeEvent } from './NoteManager';
import { Lives } from './Lives';
import { JudgementTimeline } from './JudgementTimeline';
import { Renderer, circleY } from '../lib/Renderer';
import { laneAtPoint } from '../lib/layout';

export type SessionEvent =
  | { type: 'start' }
  | { type: 'judge'; judgement: Judgement; combo: number }
  | { type: 'combo-milestone'; combo: number }
  | { type: 'combo-break'; combo: number }
  | { type: 'perfect-streak'; streak: number }
  | { type: 'life-lost'; hearts: number }
  | { type: 'life-gained'; hearts: number }
  | { type: 'spell'; kind: SpellKind }
  | { type: 'lanes'; lanes: number }
  | { type: 'fail' }
  | { type: 'finish'; result: PlayResult; autoOffsetMs: number | null }
  | { type: 'pause' }
  | { type: 'resume' };

export interface SessionOptions {
  chart: ChartFile;
  audioBuffer: AudioBuffer;
  canvas: HTMLCanvasElement;
  /** Seconds; from calibration. */
  userOffset: number;
  touch: boolean;
  /** Touch assist: early presses count (see NoteManager). */
  touchAssist: boolean;
  /** Learn the player's latency from their hits and nudge the offset while playing. */
  autoOffset: boolean;
  /** Dev/demo flag (`?nofail=1`): hearts still drain but the run never fails. */
  noFail?: boolean;
  /** Tutorial: no hearts drawn, no heart-loss effects (implies no fail). */
  hideHearts?: boolean;
  /** FX budget: 'auto' (default) drops to the low level once FPS < 45 for 3 s; 'on' = low from the start; 'off' = always full. */
  fxMode?: FxMode;
  debug: boolean;
  onEvent: (e: SessionEvent) => void;
  /** Song-time reporter for a host overlay, called at ~10 Hz from the frame loop. */
  onTime?: (songTime: number) => void;
}

/** Minimum interval between `onTime` reports, milliseconds. */
const TIME_REPORT_MS = 100;

const LEAD_IN = 2.0;
const MILESTONES = [50, 100, 250, 500, 1000];
const ASSIST_WINDOW = 0.4;
export const MAX_HEARTS = 5;
/** Slow-motion spell: the whole song (music + notes + judgement) runs at this rate for SLOW_DURATION song-seconds. */
const SLOW_RATE = 0.72;
const SLOW_DURATION = 6;
const SLOW_RAMP_IN = 0.35;
const SLOW_RAMP_OUT = 0.5;
/** Per-song note speed: notes take this many beats to reach the line (clamped in seconds), so every song reads at its own tempo. */
const APPROACH_BEATS = 3.5;
const APPROACH_MIN = 1.3;
const APPROACH_MAX = 2.4;
/** Auto-offset: window of recent timing errors and the max correction it may apply, seconds. */
const AUTO_WINDOW = 40;
const AUTO_MAX = 0.08;

/**
 * Owns one play-through: audio, clock, notes, scoring, lives, spells, input and rendering.
 * Restart = reset indices + `source.start()` — the track stays decoded in memory.
 */
export class GameSession {
  private readonly clock: Clock;
  private readonly notes: NoteManager;
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly fps = new FpsMeter();
  private readonly lowFps = new LowFpsDetector(45, 3);
  private readonly lives = new Lives(MAX_HEARTS);
  private scoring: Scoring;
  /** Every judgement of the run for the result screen — typed arrays, no per-judgement allocation. */
  private readonly timeline: JudgementTimeline;
  private raf = 0;
  private lastFrame = 0;
  private finished = false;
  private failed = false;
  private started = false;
  private paused = false;
  private destroyed = false;
  private lastJudgement: Judgement | null = null;
  private lastJudgementAt = -1;
  private lastGain = 0;
  private comboBreakAt = -1;
  private comboGrewAt = -1;
  private heartLostAt = -1;
  private slowUntil = -1;
  private slowReleasing = false;
  private perfectStreak = 0;
  private endTime = 0;
  private resizeObserver: ResizeObserver | null = null;
  private readonly sections: Section[];
  /** When each section's lane count takes over: as soon as the previous section's last note is gone, but no later than one approach before the section starts. */
  private readonly switchTimes: number[];
  private readonly deltas: number[] = [];
  private autoAdjust = 0;
  private hitsSeen = 0;
  private bassEnv = 0;
  private lastTimeReport = -Infinity;
  /** Walks `chart.beats` so the background can pulse on every beat (stronger on downbeats). */
  private readonly beatCursor: BeatCursor;
  /** Reused every frame for the spectrum skyline — the only spectrum buffer on the game side. */
  private readonly bands = new Uint8Array(SPECTRUM_BANDS);

  constructor(private readonly opts: SessionOptions) {
    this.clock = new Clock(() => audioEngine.now(), opts.userOffset);
    this.notes = new NoteManager(undefined, { assistWindow: opts.touch && opts.touchAssist ? ASSIST_WINDOW : 0 });
    const level = opts.chart.chart;
    const parsed = parseChartLevel(level);
    this.sections = parseSections(level);
    this.notes.load(parsed);
    this.switchTimes = this.sections.map((sec, i) => {
      if (i === 0) return 0;
      let lastEnd = -Infinity;
      for (const n of parsed) if (n.time < sec.time) lastEnd = Math.max(lastEnd, n.time + n.duration);
      return Math.max(sec.time - this.approachTime, lastEnd + 0.15);
    });
    const judgements = countJudgements(parsed);
    this.scoring = new Scoring(judgements);
    this.timeline = new JudgementTimeline(judgements);
    this.endTime = Math.min(opts.audioBuffer.duration, this.notes.lastTime + 1.5);
    // Per-track look: by genre when the chart carries one, otherwise deterministic from the id.
    const theme = themeFor(opts.chart.genre, opts.chart.id);
    this.renderer = new Renderer(
      opts.canvas,
      opts.touch,
      this.sections.map((s) => s.lanes),
      theme,
    );
    this.renderer.setLanes(this.sections[0].lanes, true);
    this.beatCursor = new BeatCursor(opts.chart.beats, opts.chart.bpm, opts.chart.offset, opts.chart.duration);
    if (opts.fxMode === 'on') this.renderer.setFxLevel('low');
    this.input = new Input({
      audioNow: () => audioEngine.now(),
      laneForKey: (code) => (code === CIRCLE_KEY ? CIRCLE_BUCKET : (KEY_LAYOUTS[this.renderer.lanes]?.[code] ?? -1)),
      laneAt: (x, y) => {
        const r = opts.canvas.getBoundingClientRect();
        const px = x - r.left;
        const py = y - r.top;
        if (this.circleAt(px, py)) return CIRCLE_BUCKET;
        return laneAtPoint(this.renderer.layout, px, py, opts.touch);
      },
    });
    this.notes.onJudge = this.handleJudge;
    this.notes.onRollTap = (note) => {
      sfxHit(1);
      this.renderer.rollTap(note.lane, note.lanes, note.taps, note.extra);
    };
    this.resizeObserver = new ResizeObserver(() => this.renderer.resize());
    this.resizeObserver.observe(opts.canvas);
  }

  get approachTime(): number {
    return clamp((APPROACH_BEATS * 60) / Math.max(60, this.opts.chart.bpm), APPROACH_MIN, APPROACH_MAX);
  }

  /** Dev: current song time (for the `window.__neon` hook in no-fail sessions). */
  get songTime(): number {
    return this.clock.songTime();
  }

  /** Is there a pending circle under the pointer (generous radius) within its approach window? */
  private circleAt(px: number, py: number): boolean {
    const songTime = this.clock.songTime();
    const pool = this.notes.pool;
    for (let i = this.notes.firstActive; i < this.notes.count; i++) {
      const n = pool[i];
      if (n.time - songTime > this.approachTime) break;
      if (n.kind !== 'circle' || n.state !== NoteState.Pending) continue;
      const L = this.renderer.layoutFor(n.lanes);
      const cx = L.laneX + (n.lane + 0.5) * L.laneWidth;
      const cy = circleY(L, n.seq);
      const r = Math.max(16, Math.min(L.laneWidth * 0.42, 40)) * 1.8;
      if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r) return true;
    }
    return false;
  }

  start(): void {
    if (this.destroyed) return;
    this.input.attach(this.opts.canvas, { onPress: this.onPress, onRelease: this.onRelease });
    this.restart();
  }

  /** Zero-friction restart: reset state and re-trigger the buffer source. */
  restart(): void {
    if (this.destroyed) return;
    audioEngine.stop();
    this.notes.reset();
    this.scoring.reset();
    this.timeline.reset();
    this.lives.reset();
    this.renderer.particles.clear();
    this.finished = false;
    this.failed = false;
    this.paused = false;
    this.started = true;
    this.lastJudgement = null;
    this.lastJudgementAt = -1;
    this.lastGain = 0;
    this.comboBreakAt = -1;
    this.comboGrewAt = -1;
    this.heartLostAt = -1;
    this.slowUntil = -1;
    this.slowReleasing = false;
    this.perfectStreak = 0;
    this.beatCursor.reset();
    this.renderer.setLanes(this.sections[0].lanes, true);
    const startTime = audioEngine.play(this.opts.audioBuffer, 0, () => this.finish(), LEAD_IN);
    this.clock.start(startTime);
    this.opts.onEvent({ type: 'start' });
    cancelAnimationFrame(this.raf);
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  pause(): void {
    if (!this.started || this.paused || this.finished) return;
    this.paused = true;
    this.clock.pause();
    audioEngine.pause();
    this.opts.onEvent({ type: 'pause' });
  }

  resume(): void {
    if (!this.paused) return;
    const pos = Math.max(0, this.clock.position() - 1);
    const startTime = audioEngine.play(this.opts.audioBuffer, pos, () => this.finish(), 0.3);
    this.clock.start(startTime, pos);
    this.slowUntil = -1;
    this.slowReleasing = false;
    audioEngine.tapeEffect(false, 0.01);
    this.paused = false;
    this.opts.onEvent({ type: 'resume' });
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** Dev: trigger the slow-motion spell now (only exposed in no-fail sessions). */
  debugSlow(): void {
    if (!this.opts.noFail || !this.started || this.paused || this.finished) return;
    this.castSpell('slow', 0, this.renderer.lanes);
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.input.detach();
    this.resizeObserver?.disconnect();
    audioEngine.stop();
  }

  private onPress = ({ lane, audioTime, viaMove }: { lane: number; audioTime: number; viaMove?: boolean }): void => {
    if (!this.started || this.paused || this.finished) return;
    if (lane < MAX_LANES) this.renderer.pressFeedback(lane);
    if (viaMove) return; // a finger sliding into a lane is not a new tap
    this.notes.press(lane, this.clock.toSongTime(audioTime));
  };

  private onRelease = ({ lane, audioTime }: { lane: number; audioTime: number }): void => {
    if (!this.started || this.paused || this.finished) return;
    this.notes.release(lane, this.clock.toSongTime(audioTime));
  };

  private handleJudge = ({ note, judgement, tail }: JudgeEvent): void => {
    if (this.finished) return;
    const prevCombo = this.scoring.combo;
    const before = this.scoring.score;
    this.scoring.register(judgement);
    this.lastGain = this.scoring.score - before;
    this.lastJudgement = judgement;
    this.lastJudgementAt = this.clock.songTime();
    this.timeline.record(this.lastJudgementAt, judgement, this.scoring.combo);
    this.renderer.hitFeedback(note.lane, note.lanes, judgement, note.kind === 'circle' ? note.seq : 0);

    if (judgement === 'miss') {
      audioEngine.missEffect();
      this.perfectStreak = 0;
      if (prevCombo >= 10) sfxComboBreak();
      else sfxMiss();
      if (prevCombo >= 10) {
        this.comboBreakAt = this.lastJudgementAt;
        const L = this.renderer.layout;
        this.renderer.comboBreak(L.laneX + L.laneAreaWidth / 2, L.hitY * 0.42, prevCombo);
        this.opts.onEvent({ type: 'combo-break', combo: prevCombo });
      }
      const dead = this.lives.miss();
      if (!this.opts.hideHearts) {
        this.heartLostAt = this.lastJudgementAt;
        this.renderer.heartLost(this.lives.hearts);
        this.opts.onEvent({ type: 'life-lost', hearts: this.lives.hearts });
      }
      this.opts.onEvent({ type: 'judge', judgement, combo: this.scoring.combo });
      if (dead && !this.opts.noFail && !this.opts.hideHearts) this.fail();
      return;
    }

    if (!tail) {
      sfxHit(judgement === 'perfect' ? 0 : judgement === 'great' ? 1 : 2);
      if (!note.assisted) this.learnOffset(note.hitDelta);
    }
    this.comboGrewAt = this.lastJudgementAt;
    this.perfectStreak = judgement === 'perfect' ? this.perfectStreak + 1 : 0;
    if (this.perfectStreak > 0 && this.perfectStreak % 25 === 0) this.opts.onEvent({ type: 'perfect-streak', streak: this.perfectStreak });
    if (this.lives.hit() && !this.opts.hideHearts) this.opts.onEvent({ type: 'life-gained', hearts: this.lives.hearts });
    if ((note.kind === 'slow' || note.kind === 'heart') && !tail) this.castSpell(note.kind, note.lane, note.lanes);
    const combo = this.scoring.combo;
    if (MILESTONES.includes(combo)) {
      sfxMilestone();
      this.renderer.comboMilestone(combo);
      this.opts.onEvent({ type: 'combo-milestone', combo });
    }
    this.opts.onEvent({ type: 'judge', judgement, combo });
  };

  /**
   * Auto-offset: players on phones/Bluetooth are consistently early or late. The median of the
   * last 40 timing errors is folded into the clock offset (half-steps, capped at ±80 ms) so the
   * chart drifts onto the player's ear instead of the other way round.
   */
  private learnOffset(delta: number): void {
    if (!this.opts.autoOffset) return;
    this.deltas.push(delta);
    if (this.deltas.length > AUTO_WINDOW) this.deltas.shift();
    this.hitsSeen++;
    if (this.hitsSeen % 10 !== 0 || this.deltas.length < 20) return;
    const m = median(this.deltas);
    if (Math.abs(m) < 0.012) return;
    const next = clamp(this.autoAdjust + m * 0.5, -AUTO_MAX, AUTO_MAX);
    const applied = next - this.autoAdjust;
    this.autoAdjust = next;
    this.clock.userOffset += applied;
    for (let i = 0; i < this.deltas.length; i++) this.deltas[i] -= applied;
  }

  private castSpell(kind: SpellKind, lane: number, lanes: number): void {
    this.renderer.spellFeedback(lane, lanes, kind);
    sfxRank();
    if (kind === 'slow') {
      const now = audioEngine.now();
      this.slowUntil = this.clock.songTime() + SLOW_DURATION;
      this.slowReleasing = false;
      this.clock.setRate(SLOW_RATE, SLOW_RAMP_IN, now);
      audioEngine.setPlaybackRate(SLOW_RATE, SLOW_RAMP_IN);
      audioEngine.tapeEffect(true, SLOW_RAMP_IN);
    } else if (this.lives.gain()) this.opts.onEvent({ type: 'life-gained', hearts: this.lives.hearts });
    this.opts.onEvent({ type: 'spell', kind });
  }

  private frame = (now: number): void => {
    if (this.destroyed) return;
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.fps.tick(dt);

    const songTime = this.clock.songTime();
    if (!this.paused && !this.finished) {
      const si = Math.max(0, lowerBound(this.switchTimes, songTime + 1e-9) - 1);
      const lanes = this.sections[si].lanes;
      if (lanes !== this.renderer.lanes) {
        if (songTime > 0) sfxLanes(lanes > this.renderer.lanes);
        this.renderer.setLanes(lanes, songTime <= 0);
        this.opts.onEvent({ type: 'lanes', lanes });
      }
      if (this.slowUntil > 0 && !this.slowReleasing && songTime >= this.slowUntil - SLOW_RAMP_OUT * SLOW_RATE) {
        this.slowReleasing = true;
        const t = audioEngine.now();
        this.clock.setRate(1, SLOW_RAMP_OUT, t);
        audioEngine.setPlaybackRate(1, SLOW_RAMP_OUT);
        audioEngine.tapeEffect(false, SLOW_RAMP_OUT);
      }
      if (this.slowUntil > 0 && songTime >= this.slowUntil) this.slowUntil = -1;
      this.notes.update(songTime, this.isHeld);
      this.renderer.update(dt);
      // FPS watchdog (economy mode "auto"): sustained < 45 fps after the count-in → low FX level, once.
      if ((this.opts.fxMode ?? 'auto') === 'auto' && songTime > 0 && this.lowFps.tick(this.fps.fps, dt)) {
        this.renderer.setFxLevel('low', true);
        if (this.opts.debug) console.info('[neon-tap] fps < 45 for 3 s → fx level "low" (economy mode: auto)');
      }
      if (songTime >= this.endTime) this.finish();
    }
    // Host overlay (tutorial captions): song time at ~10 Hz, no per-frame work otherwise.
    if (this.opts.onTime && now - this.lastTimeReport >= TIME_REPORT_MS) {
      this.lastTimeReport = now;
      this.opts.onTime(songTime);
    }

    // The analyser is read at most once per frame: on the full FX level `spectrum()` fills the
    // skyline bands and returns the bass level of that same read; otherwise only the bass is read.
    let bass = 0;
    if (!this.paused) {
      if (this.renderer.fx === 'full' && !this.finished) {
        // Music-synchronised background (skipped entirely on the low FX level): beat pulses from
        // the tracked beats and the spectrum skyline from the analyser, both into reused buffers.
        const beat = this.beatCursor.poll(songTime);
        if (beat > 0) this.renderer.beatFeedback(beat);
        bass = audioEngine.spectrum(this.bands);
        this.renderer.feedSpectrum(this.bands, dt);
      } else {
        bass = audioEngine.bassLevel();
      }
    }

    // Audio-reactive pulse: bass envelope with instant attack and quick decay, gated so sustained
    // bass does not glow permanently — only hits above the running floor light up.
    this.bassEnv = Math.max(bass, this.bassEnv - dt * 6);
    const pulse = Math.max(0, Math.min(1, (this.bassEnv - 0.45) / 0.4));

    const s = this.scoring;
    const slowLeft = this.slowUntil > 0 ? this.slowUntil - songTime : 0;
    this.renderer.draw(this.notes, {
      songTime,
      approachTime: this.approachTime,
      pulse,
      beatPhase: this.beatCursor.phase(songTime),
      combo: s.combo,
      comboAge: this.comboGrewAt < 0 ? Infinity : songTime - this.comboGrewAt,
      score: s.score,
      accuracy: s.accuracy,
      progress: Math.max(0, Math.min(1, songTime / this.endTime)),
      hearts: this.lives.hearts,
      maxHearts: this.opts.hideHearts ? 0 : MAX_HEARTS,
      heartLostAge: this.heartLostAt < 0 ? Infinity : songTime - this.heartLostAt,
      slowRemaining: slowLeft > 0 ? Math.min(1, slowLeft / SLOW_DURATION) : -1,
      held: this.isHeld,
      lastJudgement: this.lastJudgement,
      lastJudgementAge: this.lastJudgementAt < 0 ? 1 : songTime - this.lastJudgementAt,
      lastGain: this.lastGain,
      comboBreakAge: this.comboBreakAt < 0 ? -1 : songTime - this.comboBreakAt,
      debug: this.opts.debug
        ? {
            fps: this.fps.fps,
            worstMs: this.fps.worstMs,
            latencyMs: Math.round(audioEngine.outputLatency() * 1000),
            visibleNotes: this.renderer.visibleNotes,
            offsetMs: Math.round(this.clock.userOffset * 1000),
            rate: this.clock.rateAt(),
          }
        : null,
    });

    if (this.failed) {
      this.renderer.drawOverlayText('ПРОВАЛ', 'R — ещё раз', '#ff2bd6');
    } else if (songTime < 0) {
      this.renderer.drawOverlayText(String(Math.ceil(-songTime)));
    } else if (this.paused) {
      this.renderer.drawOverlayText('ПАУЗА', 'Esc — продолжить · R — заново');
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private isHeld = (lane: number): boolean => this.input.isHeld(lane);

  private fail(): void {
    if (this.finished) return;
    this.failed = true;
    audioEngine.missEffect();
    this.opts.onEvent({ type: 'fail' });
    window.setTimeout(() => this.finish(), 900);
    this.finished = true;
    audioEngine.stop();
  }

  private finish(): void {
    if (this.destroyed) return;
    if (this.finished && !this.failed) return;
    this.finished = true;
    if (!this.failed) this.notes.update(Number.POSITIVE_INFINITY, () => false);
    const s = this.scoring;
    const result: PlayResult = {
      trackId: this.opts.chart.id,
      score: s.score,
      accuracy: s.accuracy,
      rank: this.failed ? 'D' : s.rank,
      maxCombo: s.maxCombo,
      totalNotes: s.totalNotes,
      counts: { ...s.counts },
      fullCombo: !this.failed && s.isFullCombo,
      notesToS: notesToReach(s.counts, 0.95),
      failed: this.failed,
      hearts: this.lives.hearts,
      timeline: this.timeline.toResult(),
      duration: this.opts.audioBuffer.duration,
    };
    const autoOffsetMs = this.opts.autoOffset && this.hitsSeen >= 60 && Math.abs(this.autoAdjust) >= 0.01 ? Math.round(this.clock.userOffset * 1000) : null;
    this.failed = false;
    this.opts.onEvent({ type: 'finish', result, autoOffsetMs });
  }
}
