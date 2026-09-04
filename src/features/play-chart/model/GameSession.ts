import { BASE_APPROACH_TIME, KEY_LAYOUTS } from '@/shared/config/constants';
import { audioEngine, Clock, Conductor, sfxComboBreak, sfxHit, sfxMilestone, sfxMiss, sfxRank } from '@/shared/lib/audio';
import { Input } from '@/shared/lib/input/Input';
import { lowerBound } from '@/shared/lib/math';
import { FpsMeter } from '@/shared/lib/render';
import type { ChartFile } from '@/shared/types/chart';
import type { PlayResult } from '@/shared/types/result';
import { countJudgements, parseChartLevel, parseSections, type Section, type SpellKind } from '@/entities/chart';
import { Scoring, notesToReach, type Judgement } from '@/entities/score';
import type { Difficulty } from '@/shared/config/constants';
import { NoteManager, type JudgeEvent } from './NoteManager';
import { Lives } from './Lives';
import { Renderer } from '../lib/Renderer';
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
  /** Touch assist: early presses count (see NoteManager). */
  touchAssist: boolean;
  /** Dev/demo flag (`?nofail=1`): hearts still drain but the run never fails. */
  noFail?: boolean;
  debug: boolean;
  onEvent: (e: SessionEvent) => void;
}

const LEAD_IN = 2.0;
const MILESTONES = [50, 100, 250, 500, 1000];
const ASSIST_WINDOW = 0.4;
export const MAX_HEARTS = 5;
const SLOW_DURATION = 6;
/** Note speed while the slow spell is active (0.6 = 40 % slower). */
const SLOW_FACTOR = 0.6;

/**
 * Owns one play-through: audio, clock, notes, scoring, lives, spells, input and rendering.
 * Restart = reset indices + `source.start()` — the track stays decoded in memory (GDD §1.4).
 */
export class GameSession {
  private readonly clock: Clock;
  private readonly conductor: Conductor;
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
  private slowFactor = 1;
  private perfectStreak = 0;
  private endTime = 0;
  private resizeObserver: ResizeObserver | null = null;
  private readonly sections: Section[];
  private readonly sectionTimes: number[];

  constructor(private readonly opts: SessionOptions) {
    this.clock = new Clock(() => audioEngine.now(), opts.userOffset);
    this.conductor = new Conductor(opts.chart.bpm, opts.chart.offset, 4, opts.chart.beats);
    this.notes = new NoteManager(undefined, { assistWindow: opts.touch && opts.touchAssist ? ASSIST_WINDOW : 0 });
    const level = opts.chart.charts[opts.difficulty];
    const parsed = parseChartLevel(level);
    this.sections = parseSections(level);
    this.sectionTimes = this.sections.map((s) => s.time);
    this.notes.load(parsed);
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
      laneForKey: (code) => KEY_LAYOUTS[this.renderer.lanes]?.[code] ?? -1,
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
    return BASE_APPROACH_TIME / this.opts.scrollSpeed / this.slowFactor;
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
    this.slowFactor = 1;
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
    audioEngine.pause();
    this.clock.pause();
    this.opts.onEvent({ type: 'pause' });
  }

  resume(): void {
    if (!this.paused) return;
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
    this.renderer.hitFeedback(note.lane, note.lanes, judgement);

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

    if (!tail) sfxHit(judgement === 'perfect' ? 0 : judgement === 'great' ? 1 : 2);
    this.comboGrewAt = this.lastJudgementAt;
    this.perfectStreak = judgement === 'perfect' ? this.perfectStreak + 1 : 0;
    if (this.perfectStreak > 0 && this.perfectStreak % 25 === 0) this.opts.onEvent({ type: 'perfect-streak', streak: this.perfectStreak });
    if (this.lives.hit()) this.opts.onEvent({ type: 'life-gained', hearts: this.lives.hearts });
    if (note.spell && !tail) this.castSpell(note.spell, note.lane, note.lanes);
    const combo = this.scoring.combo;
    if (MILESTONES.includes(combo)) {
      sfxMilestone();
      this.renderer.comboMilestone();
      this.opts.onEvent({ type: 'combo-milestone', combo });
    }
    this.opts.onEvent({ type: 'judge', judgement, combo });
  };

  private castSpell(kind: SpellKind, lane: number, lanes: number): void {
    this.renderer.spellFeedback(lane, lanes, kind);
    sfxRank();
    if (kind === 'slow') this.slowUntil = this.clock.songTime() + SLOW_DURATION;
    else if (this.lives.gain()) this.opts.onEvent({ type: 'life-gained', hearts: this.lives.hearts });
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
      const si = Math.max(0, lowerBound(this.sectionTimes, songTime + 1e-9) - 1);
      const lanes = this.sections[si].lanes;
      if (lanes !== this.renderer.lanes) {
        this.renderer.setLanes(lanes, songTime <= 0);
        this.opts.onEvent({ type: 'lanes', lanes });
      }
      this.notes.update(songTime, this.isHeld);
      const target = songTime < this.slowUntil ? SLOW_FACTOR : 1;
      this.slowFactor += (target - this.slowFactor) * Math.min(1, dt * 6);
      this.renderer.update(dt);
      if (songTime >= this.endTime) this.finish();
    }

    const s = this.scoring;
    const slowLeft = this.slowUntil - songTime;
    this.renderer.draw(this.notes, {
      songTime,
      approachTime: this.approachTime,
      beatPhase: this.conductor.beatPhase(songTime),
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
        ? { fps: this.fps.fps, worstMs: this.fps.worstMs, latencyMs: Math.round(audioEngine.outputLatency() * 1000), visibleNotes: this.renderer.visibleNotes }
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
    // Let the "you lost" moment land, then hand over to the result screen.
    window.setTimeout(() => this.finish(), 900);
    this.finished = true;
    audioEngine.stop();
  }

  private finish(): void {
    if (this.destroyed) return;
    if (this.finished && !this.failed) return;
    this.finished = true;
    // Flush any remaining pending notes as misses so totals add up.
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
    this.failed = false; // guard against a second finish() from the timer
    this.opts.onEvent({ type: 'finish', result });
  }
}
