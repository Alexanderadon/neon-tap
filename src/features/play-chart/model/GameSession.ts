import { CIRCLE_BUCKET, CIRCLE_KEY, KEY_LAYOUTS } from '@/shared/config/constants';
import { audioEngine, Clock, sfxComboBreak, sfxHit, sfxMilestone, sfxMiss, sfxRank } from '@/shared/lib/audio';
import { Input } from '@/shared/lib/input/Input';
import { clamp, lowerBound, median } from '@/shared/lib/math';
import { FpsMeter } from '@/shared/lib/render';
import type { ChartFile } from '@/shared/types/chart';
import type { PlayResult } from '@/shared/types/result';
import { countJudgements, parseChartLevel, parseSections, type Section, type SpellKind } from '@/entities/chart';
import { Scoring, notesToReach, type Judgement } from '@/entities/score';
import type { Difficulty } from '@/shared/config/constants';
import { NoteManager, type JudgeEvent } from './NoteManager';
import { Lives } from './Lives';
import { Renderer, circleY } from '../lib/Renderer';
import { NoteState } from './NoteManager';
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
  difficulty: Difficulty;
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
  debug: boolean;
  onEvent: (e: SessionEvent) => void;
}

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
 * Restart = reset indices + `source.start()` — the track stays decoded in memory (GDD §1.4).
 */
export class GameSession {
  private readonly clock: Clock;
  private readonly notes: NoteManager;
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly fps = new FpsMeter();
  private readonly lives = new Lives(MAX_HEARTS);
  private scoring: Scoring;
  private raf = 0;
  private lastFrame = 0;
  private finished = false;
  private failed = false;
  private started = false;
  private paused = false;
  private destroyed = false;
  private lastJudgement: Judgement | null = null;
  private lastJudgementAt = -1;
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

  constructor(private readonly opts: SessionOptions) {
    this.clock = new Clock(() => audioEngine.now(), opts.userOffset);
    this.notes = new NoteManager(undefined, { assistWindow: opts.touch && opts.touchAssist ? ASSIST_WINDOW : 0 });
    const level = opts.chart.charts[opts.difficulty];
    const parsed = parseChartLevel(level);
    this.sections = parseSections(level);
    this.notes.load(parsed);
    this.switchTimes = this.sections.map((sec, i) => {
      if (i === 0) return 0;
      let lastEnd = -Infinity;
      for (const n of parsed) if (n.time < sec.time) lastEnd = Math.max(lastEnd, n.time + n.duration);
      return Math.max(sec.time - this.approachTime, lastEnd + 0.15);
    });
    this.scoring = new Scoring(countJudgements(parsed));
    this.endTime = Math.min(opts.audioBuffer.duration, this.notes.lastTime + 1.5);
    this.renderer = new Renderer(
      opts.canvas,
      opts.touch,
      this.sections.map((s) => s.lanes),
    );
    this.renderer.setLanes(this.sections[0].lanes, true);
    this.input = new Input({
      audioNow: () => audioEngine.now(),
      laneForKey: (code) => (code === CIRCLE_KEY ? CIRCLE_BUCKET : (KEY_LAYOUTS[this.renderer.lanes]?.[code] ?? -1)),
      laneAt: (x, y) => {
        const r = opts.canvas.getBoundingClientRect();
        const px = x - r.left;
        const py = y - r.top;
        // A tap on a visible circle hits the circle, not the lane under it.
        if (this.circleAt(px, py)) return CIRCLE_BUCKET;
        return laneAtPoint(this.renderer.layout, px, py, opts.touch);
      },
    });
    this.notes.onJudge = this.handleJudge;
    this.resizeObserver = new ResizeObserver(() => this.renderer.resize());
    this.resizeObserver.observe(opts.canvas);
  }

  get approachTime(): number {
    return clamp((APPROACH_BEATS * 60) / Math.max(60, this.opts.chart.bpm), APPROACH_MIN, APPROACH_MAX);
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
    this.lives.reset();
    this.renderer.particles.clear();
    this.finished = false;
    this.failed = false;
    this.paused = false;
    this.started = true;
    this.lastJudgement = null;
    this.lastJudgementAt = -1;
    this.comboBreakAt = -1;
    this.comboGrewAt = -1;
    this.heartLostAt = -1;
    this.slowUntil = -1;
    this.slowReleasing = false;
    this.perfectStreak = 0;
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
    // Rewind slightly so the player can re-enter the flow; the slow spell ends on resume.
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

  /** Dev: current song time (for the `window.__neon` hook in no-fail sessions). */
  get songTime(): number {
    return this.clock.songTime();
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

  private onPress = ({ lane, audioTime }: { lane: number; audioTime: number }): void => {
    if (!this.started || this.paused || this.finished) return;
    this.notes.press(lane, this.clock.toSongTime(audioTime));
  };

  private onRelease = ({ lane, audioTime }: { lane: number; audioTime: number }): void => {
    if (!this.started || this.paused || this.finished) return;
    this.notes.release(lane, this.clock.toSongTime(audioTime));
  };

  private handleJudge = ({ note, judgement, tail }: JudgeEvent): void => {
    if (this.finished) return;
    const prevCombo = this.scoring.combo;
    this.scoring.register(judgement);
    this.lastJudgement = judgement;
    this.lastJudgementAt = this.clock.songTime();
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
      this.heartLostAt = this.lastJudgementAt;
      this.renderer.heartLost(this.lives.hearts);
      this.opts.onEvent({ type: 'life-lost', hearts: this.lives.hearts });
      this.opts.onEvent({ type: 'judge', judgement, combo: this.scoring.combo });
      if (dead && !this.opts.noFail) this.fail();
      return;
    }

    if (!tail) {
      sfxHit(judgement === 'perfect' ? 0 : judgement === 'great' ? 1 : 2);
      if (!note.assisted) this.learnOffset(note.hitDelta);
    }
    this.comboGrewAt = this.lastJudgementAt;
    this.perfectStreak = judgement === 'perfect' ? this.perfectStreak + 1 : 0;
    if (this.perfectStreak > 0 && this.perfectStreak % 25 === 0) this.opts.onEvent({ type: 'perfect-streak', streak: this.perfectStreak });
    if (this.lives.hit()) this.opts.onEvent({ type: 'life-gained', hearts: this.lives.hearts });
    if ((note.kind === 'slow' || note.kind === 'heart') && !tail) this.castSpell(note.kind, note.lane, note.lanes);
    const combo = this.scoring.combo;
    if (MILESTONES.includes(combo)) {
      sfxMilestone();
      this.renderer.comboMilestone();
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
    // A positive delta means the player is late → the audio reaches them late → raise the offset.
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
      // Lane-count sections: switch (with the transition FX) when the song reaches a new one.
      const si = Math.max(0, lowerBound(this.switchTimes, songTime + 1e-9) - 1);
      const lanes = this.sections[si].lanes;
      if (lanes !== this.renderer.lanes) {
        this.renderer.setLanes(lanes, songTime <= 0);
        this.opts.onEvent({ type: 'lanes', lanes });
      }
      // Slow-motion release: ramp music and clock back to full speed together.
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
      if (songTime >= this.endTime) this.finish();
    }

    // Audio-reactive pulse: bass envelope with instant attack and ~150 ms decay, gated so sustained
    // bass does not glow permanently — only hits above the running floor light up.
    const bass = this.paused ? 0 : audioEngine.bassLevel();
    this.bassEnv = Math.max(bass, this.bassEnv - dt * 6);
    const pulse = Math.max(0, Math.min(1, (this.bassEnv - 0.45) / 0.4));

    const s = this.scoring;
    const slowLeft = this.slowUntil > 0 ? this.slowUntil - songTime : 0;
    this.renderer.draw(this.notes, {
      songTime,
      approachTime: this.approachTime,
      pulse,
      combo: s.combo,
      comboAge: this.comboGrewAt < 0 ? Infinity : songTime - this.comboGrewAt,
      score: s.score,
      accuracy: s.accuracy,
      progress: Math.max(0, Math.min(1, songTime / this.endTime)),
      hearts: this.lives.hearts,
      maxHearts: MAX_HEARTS,
      heartLostAge: this.heartLostAt < 0 ? Infinity : songTime - this.heartLostAt,
      slowRemaining: slowLeft > 0 ? Math.min(1, slowLeft / SLOW_DURATION) : -1,
      held: this.isHeld,
      lastJudgement: this.lastJudgement,
      lastJudgementAge: this.lastJudgementAt < 0 ? 1 : songTime - this.lastJudgementAt,
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
      difficulty: this.opts.difficulty,
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
    };
    // Hand the learned latency back so it can be persisted (only after enough evidence).
    const autoOffsetMs = this.opts.autoOffset && this.hitsSeen >= 60 && Math.abs(this.autoAdjust) >= 0.01 ? Math.round(this.clock.userOffset * 1000) : null;
    this.failed = false;
    this.opts.onEvent({ type: 'finish', result, autoOffsetMs });
  }
}
