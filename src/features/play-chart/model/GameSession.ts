import { BASE_APPROACH_TIME } from '@/shared/config/constants';
import { audioEngine, Clock, Conductor, sfxComboBreak, sfxHit, sfxMiss, sfxMilestone } from '@/shared/lib/audio';
import { Input } from '@/shared/lib/input/Input';
import { FpsMeter } from '@/shared/lib/render';
import type { ChartFile } from '@/shared/types/chart';
import type { PlayResult } from '@/shared/types/result';
import { countJudgements, parseChartLevel } from '@/entities/chart';
import { Scoring, notesToReach, type Judgement } from '@/entities/score';
import type { Difficulty } from '@/shared/config/constants';
import { NoteManager, type JudgeEvent } from './NoteManager';
import { Renderer } from '../lib/Renderer';
import { laneAtPoint } from '../lib/layout';

export type SessionEvent =
  | { type: 'start' }
  | { type: 'judge'; judgement: Judgement; combo: number }
  | { type: 'combo-milestone'; combo: number }
  | { type: 'combo-break'; combo: number }
  | { type: 'perfect-streak'; streak: number }
  | { type: 'finish'; result: PlayResult }
  | { type: 'pause' }
  | { type: 'resume' };

export interface SessionOptions {
  chart: ChartFile;
  difficulty: Difficulty;
  audioBuffer: AudioBuffer;
  canvas: HTMLCanvasElement;
  /** Seconds; from calibration. */
  userOffset: number;
  scrollSpeed: number;
  touch: boolean;
  debug: boolean;
  onEvent: (e: SessionEvent) => void;
}

const LEAD_IN = 2.0;
const MILESTONES = [50, 100, 250, 500, 1000];

/**
 * Owns one play-through: audio, clock, notes, scoring, input and rendering.
 * Restart = reset indices + `source.start()` — the track stays decoded in memory (GDD §1.4).
 */
export class GameSession {
  private readonly clock: Clock;
  private readonly conductor: Conductor;
  private readonly notes = new NoteManager();
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly fps = new FpsMeter();
  private scoring: Scoring;
  private raf = 0;
  private lastFrame = 0;
  private finished = false;
  private started = false;
  private paused = false;
  private destroyed = false;
  private lastJudgement: Judgement | null = null;
  private lastJudgementAt = -1;
  private comboBreakAt = -1;
  private perfectStreak = 0;
  private endTime = 0;
  private resizeObserver: ResizeObserver | null = null;

  constructor(private readonly opts: SessionOptions) {
    this.clock = new Clock(() => audioEngine.now(), opts.userOffset);
    this.conductor = new Conductor(opts.chart.bpm, opts.chart.offset);
    const level = opts.chart.charts[opts.difficulty];
    const parsed = parseChartLevel(level);
    this.notes.load(parsed);
    this.scoring = new Scoring(countJudgements(parsed));
    this.endTime = Math.min(opts.audioBuffer.duration, this.notes.lastTime + 1.5);
    this.renderer = new Renderer(opts.canvas, opts.touch);
    this.input = new Input({
      audioNow: () => audioEngine.now(),
      laneAt: (x, y) => {
        const r = opts.canvas.getBoundingClientRect();
        return laneAtPoint(this.renderer.layout, x - r.left, y - r.top, opts.touch);
      },
    });
    this.notes.onJudge = this.handleJudge;
    this.resizeObserver = new ResizeObserver(() => this.renderer.resize());
    this.resizeObserver.observe(opts.canvas);
  }

  get approachTime(): number {
    return BASE_APPROACH_TIME / this.opts.scrollSpeed;
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
    this.renderer.particles.clear();
    this.finished = false;
    this.paused = false;
    this.started = true;
    this.lastJudgement = null;
    this.lastJudgementAt = -1;
    this.comboBreakAt = -1;
    this.perfectStreak = 0;
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
    audioEngine.pause();
    this.clock.pause();
    this.opts.onEvent({ type: 'pause' });
  }

  resume(): void {
    if (!this.paused) return;
    // Rewind slightly so the player can re-enter the flow.
    const pos = Math.max(0, audioEngine.position() - 1);
    const startTime = audioEngine.play(this.opts.audioBuffer, pos, () => this.finish(), 0.3);
    this.clock.start(startTime);
    this.paused = false;
    this.opts.onEvent({ type: 'resume' });
  }

  get isPaused(): boolean {
    return this.paused;
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
    const t = this.clock.toSongTime(audioTime);
    this.notes.press(lane, t);
  };

  private onRelease = ({ lane, audioTime }: { lane: number; audioTime: number }): void => {
    if (!this.started || this.paused || this.finished) return;
    this.notes.release(lane, this.clock.toSongTime(audioTime));
  };

  private handleJudge = ({ note, judgement, tail }: JudgeEvent): void => {
    const prevCombo = this.scoring.combo;
    this.scoring.register(judgement);
    this.lastJudgement = judgement;
    this.lastJudgementAt = this.clock.songTime();
    this.renderer.hitFeedback(note.lane, judgement);

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
    } else {
      if (!tail) sfxHit(judgement === 'perfect' ? 0 : judgement === 'great' ? 1 : 2);
      this.perfectStreak = judgement === 'perfect' ? this.perfectStreak + 1 : 0;
      if (this.perfectStreak > 0 && this.perfectStreak % 25 === 0) this.opts.onEvent({ type: 'perfect-streak', streak: this.perfectStreak });
      const combo = this.scoring.combo;
      if (MILESTONES.includes(combo)) {
        sfxMilestone();
        this.renderer.comboMilestone();
        this.opts.onEvent({ type: 'combo-milestone', combo });
      }
    }
    this.opts.onEvent({ type: 'judge', judgement, combo: this.scoring.combo });
  };

  private frame = (now: number): void => {
    if (this.destroyed) return;
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.fps.tick(dt);

    const songTime = this.clock.songTime();
    if (!this.paused && !this.finished) {
      this.notes.update(songTime, this.isHeld);
      this.renderer.update(dt);
      if (songTime >= this.endTime) this.finish();
    }

    const s = this.scoring;
    this.renderer.draw(this.notes, {
      songTime,
      approachTime: this.approachTime,
      beatPhase: this.conductor.beatPhase(songTime),
      combo: s.combo,
      score: s.score,
      accuracy: s.accuracy,
      progress: Math.max(0, Math.min(1, songTime / this.endTime)),
      held: this.isHeld,
      lastJudgement: this.lastJudgement,
      lastJudgementAge: this.lastJudgementAt < 0 ? 1 : songTime - this.lastJudgementAt,
      comboBreakAge: this.comboBreakAt < 0 ? -1 : songTime - this.comboBreakAt,
      debug: this.opts.debug
        ? { fps: this.fps.fps, worstMs: this.fps.worstMs, latencyMs: Math.round(audioEngine.outputLatency() * 1000), visibleNotes: this.renderer.visibleNotes }
        : null,
    });

    if (songTime < 0) {
      const n = Math.ceil(-songTime);
      this.renderer.drawOverlayText(String(n));
    } else if (this.paused) {
      this.renderer.drawOverlayText('ПАУЗА', 'Esc — продолжить · R — заново');
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private isHeld = (lane: number): boolean => this.input.isHeld(lane);

  private finish(): void {
    if (this.finished || this.destroyed) return;
    this.finished = true;
    // Flush any remaining pending notes as misses so totals add up.
    this.notes.update(Number.POSITIVE_INFINITY, () => false);
    const s = this.scoring;
    const result: PlayResult = {
      trackId: this.opts.chart.id,
      difficulty: this.opts.difficulty,
      score: s.score,
      accuracy: s.accuracy,
      rank: s.rank,
      maxCombo: s.maxCombo,
      totalNotes: s.totalNotes,
      counts: { ...s.counts },
      fullCombo: s.isFullCombo,
      notesToS: notesToReach(s.counts, 0.95),
    };
    this.opts.onEvent({ type: 'finish', result });
  }
}
