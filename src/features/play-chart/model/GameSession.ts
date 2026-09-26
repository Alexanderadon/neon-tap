import { CIRCLE_BUCKET, CIRCLE_KEY, HIT_WINDOWS, KEY_LAYOUTS, MAX_LANES, SPIN_BONUS_PER_REV, SPIN_BUCKET } from '@/shared/config/constants';
import { audioEngine, BeatCursor, Clock, SPECTRUM_BANDS, sfxComboBreak, sfxGem, sfxHit, sfxLanes, sfxMilestone, sfxMiss, sfxRank } from '@/shared/lib/audio';
import { Input } from '@/shared/lib/input/Input';
import { clamp, lowerBound, median } from '@/shared/lib/math';
import { FpsMeter, LowFpsDetector, themeFor, themeForMood } from '@/shared/lib/render';
import type { ChartFile } from '@/shared/types/chart';
import type { PlayResult } from '@/shared/types/result';
import { countJudgements, parseChartLevel, parseSections, type ParsedNote, type Section, type SpellKind } from '@/entities/chart';
import type { FxAuto, FxMode, MeetKind } from '@/entities/settings';
import { findTrack } from '@/entities/track';
import { Scoring, notesToReach, type Judgement } from '@/entities/score';
import { NoteManager, NoteState, type JudgeEvent, type PooledNote } from './NoteManager';
import { SpinTracker } from './SpinTracker';
import { Lives } from './Lives';
import { JudgementTimeline } from './JudgementTimeline';
import { pickGems, pickLoopGems } from './gems';
import { LEVELS, levelOutcome, levelRate } from './levels';
import { beatSeconds, songMap } from './songMap';
import { REVIVE_HEARTS, REVIVE_RESUME_AT, canOfferRevive } from './revive';
import { OffsetProbe, type OffsetProbeMode } from './offsetProbe';
import { gapCountLeft, gapReturns, introStart, notesFrom } from './pacing';
import { MeetTracker, planMeetings, type Meeting } from './firstMeet';
import { Renderer, circlePos, circleRadius, spinGeometry, type SpinFrame } from '../lib/Renderer';
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
  /** A crystal was collected: its value and the run total so far. */
  | { type: 'gem'; value: number; total: number }
  | { type: 'lanes'; lanes: number }
  /** A level was finished: the star earned and the level that follows (null when the run is over). */
  | { type: 'star'; stars: number; crowns: number; next: number | null }
  /** The next level's count-in has begun (level 2 and up; the first level is `start`). */
  | { type: 'level'; level: number }
  /** Out of hearts and the run cannot be revived: the fail frame shows `stars` kept (0 = «ПРОВАЛ», else «СТОП»). */
  | { type: 'fail'; stars: number; crowns: number; finale: boolean }
  | { type: 'finish'; result: PlayResult; autoOffsetMs: number | null }
  /** The wide latency probe settled (`offsetProbe`): the player's offset in ms, already applied — the host saves it at once, before the first track. */
  | { type: 'offset'; offsetMs: number }
  /** A mechanic met for the first time: its card rises (`card`), or the card on screen goes (null). Once per kind; the host marks it seen. */
  | { type: 'meet'; card: Meeting | null }
  /** The FPS watchdog dropped the FX level (economy mode 'auto'): the host remembers it, the next runs start low. */
  | { type: 'fx-low' }
  /** Paused (the host draws the pause overlay from this snapshot). */
  | { type: 'pause'; score: number; accuracy: number; level: number }
  | { type: 'resume' }
  /**
   * The fifth heart is gone and a second chance can be offered: the field is frozen, the music paused,
   * and fail() waits for the host — `revive()` once it is granted (the ad's reward, or NEON PASS),
   * `declineRevive()` otherwise. The host may play an ad meanwhile: nothing here moves until then.
   */
  | { type: 'hearts-out'; score: number; accuracy: number; level: number }
  /** A revive was granted: hearts pop back, the count-in runs, then `resume` follows. */
  | { type: 'revive' };

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
  /**
   * The wide latency probe (see OffsetProbe): presses within ±300 ms of a note settle the offset in one
   * go once they agree — 'single-lane' on the single-lane sections (the tutorial), 'all-lanes' on every
   * lane (a run while the offset is still unsettled). Reported once through the `offset` event. Absent = off.
   */
  offsetProbe?: OffsetProbeMode;
  /** Dev/demo flag (`?nofail=1`): hearts still drain but the run never fails. */
  noFail?: boolean;
  /** Dev/review flag (`?auto=1`): the session hits every tile itself — watch and listen to a chart without playing it. */
  autoplay?: boolean;
  /** Tutorial: no hearts drawn, no heart-loss effects (implies no fail). */
  hideHearts?: boolean;
  /** Offer a second chance when the hearts run out (default on; off in the tutorial / no-fail runs). */
  revive?: boolean;
  /**
   * Asked the moment the hearts run out: can the player have the second chance now (NEON PASS, or
   * an ad provider that can show the rewarded ad — `reviveAvailable`)? When false the run fails as
   * usual — nothing is offered. Absent = always.
   */
  canRevive?: () => boolean;
  /** Crystals: a few plain taps per run become gems (default on; off in the tutorial). */
  gems?: boolean;
  /** Levels: the song is played up to three times in a row, faster each time, a star per level (default on; the tutorial plays once). */
  levels?: boolean;
  /** Endless mode: after the third level the song keeps looping, faster every loop, hearts not refilled, a crown per loop. */
  endless?: boolean;
  /**
   * Silence (pacing.ts): a long intro is skipped — every level starts 4 s before the playing, lone notes
   * earlier than that are left out — and a «3 · 2 · 1» counts back in after every long empty stretch.
   * Default on; off in the tutorial, whose captions run on song time.
   */
  pacing?: boolean;
  /**
   * Mechanics the player has already met (`settings.seenKinds`): the first slide, roll, circle or spinner
   * of any other kind gets its card two beats ahead (see firstMeet.ts), without pausing. Absent = no
   * cards (the tutorial has its own).
   */
  seenKinds?: readonly MeetKind[];
  /** Fixed seed for the gem picks (tests / demos); by default every run rolls its own. */
  gemSeed?: number;
  /** FX budget: 'auto' (default) drops to the low level once FPS < 45 for 3 s; 'on' = low from the start; 'off' = always full. */
  fxMode?: FxMode;
  /** Economy mode 'auto' starts low: an earlier run's watchdog dropped the FX level on this device (`settings.fxAuto`). */
  fxAuto?: FxAuto;
  debug: boolean;
  onEvent: (e: SessionEvent) => void;
  /** Song-time reporter for a host overlay, called at ~10 Hz from the frame loop. */
  onTime?: (songTime: number) => void;
}

/** Minimum interval between `onTime` reports, milliseconds. */
const TIME_REPORT_MS = 100;

const LEAD_IN = 2.0;
/** The fail / stop frame (stars, verdict, tag) stays this long before the result. */
const FAIL_SHOW_SEC = 2.2;
/** Between levels: the star show, with the song's tail fading out under it; the next pass fades back in over its count-in. */
const STAR_SHOW_SEC = 2.4;
const FADE_OUT_SEC = 1.8;
const FADE_IN_SEC = 2.0;
/** The spinner's wheel fades out this long after its verdict. */
const SPIN_FADE_SEC = 0.35;
/** A combo milestone every this many hits: the number leaps, the field shakes, embers burst (and from COMBO_FIRE_FROM the number burns). */
const MILESTONE_EVERY = 50;
/** Touch assist: a tap this early (beyond the Good window) arms the note to fire on its own moment — a bit of slack for touch latency, not a whole beat. */
const ASSIST_WINDOW = 0.2;
export const MAX_HEARTS = 5;
/** A heart caught with all ten lives already there pays this many crystals. */
const HEART_OVERFLOW_CRYSTALS = 5;
/** Slow-motion spell: the whole song (music + notes + judgement) runs at this rate for SLOW_DURATION song-seconds. */
const SLOW_RATE = 0.72;
const SLOW_DURATION = 6;
const SLOW_RAMP_IN = 0.35;
const SLOW_RAMP_OUT = 0.5;
/** Per-song note speed: notes take this many beats to reach the line (clamped in seconds), so a fast song scrolls fast — the lane runs at the music's tempo. */
const APPROACH_BEATS = 3.5;
const APPROACH_MIN = 0.9;
const APPROACH_MAX = 2.4;
/** The saved offset (calibration + everything learned) never leaves this range: a tap bias, not a drift. */
const AUTO_TOTAL_MAX = 0.25;
/** The learned offset glides towards its target at this many seconds per second (80 ms in ~1.3 s). */
const OFFSET_SLEW = 0.06;
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
  /** Parsed chart notes (sorted) — the gem picker runs over them on every restart. */
  private readonly parsed: readonly ParsedNote[];
  /** Crystals collected this run. */
  private crystals = 0;
  private gemAt = -1;
  /** Where the auto-learned offset is heading; the live clock offset glides towards it. */
  private offsetTarget = 0;
  private failTimer = 0;
  private levelTimer = 0;
  private reviveTimer = 0;
  /** Revive: frozen with the offer open / hearts popping back and counting in; the one revive is spent; seconds since «Продолжить». */
  private heartsOut = false;
  private reviving = false;
  private reviveUsed = false;
  private reviveAge = 0;
  /** The audio buffer reached its end; the run finishes once the last window has closed. */
  private audioEnded = false;
  /** Level being played (1-based), the stars earned so far and the level's playback rate (the slow spell scales it). */
  private level = 1;
  private starsEarned = 0;
  /** Endless loops finished past the third level (a crown each). */
  private crownsEarned = 0;
  /** The run's score at the third star — what an endless run's record and leaderboard entry count. */
  private scoreAtStars = -1;
  private baseRate = 1;
  /** The star show is on (the next level's count-in is scheduled); a pause asked for now takes effect when it starts. */
  private betweenLevels = false;
  private pauseWanted = false;
  /** The spinner on screen (approaching or running) and the wheel that reads the player's circling. */
  private spinNote: PooledNote | null = null;
  private readonly spin = new SpinTracker();
  private spinBonus = 0;
  private spinBonusAt = -1;
  /** The running spinner has started counting (the wheel was zeroed at its first frame). */
  private spinStarted = false;
  /** Autoplay: the next parsed note to hit, and the releases / roll taps still due (song time). */
  private autoNext = 0;
  private autoDue: { bucket: number; at: number; press: boolean }[] = [];
  /** When each section's lane count takes over: as soon as the previous section's last note is gone, but no later than one approach before the section starts. */
  private readonly switchTimes: number[];
  /** Where every level starts (song seconds): 0, or a little before the playing when the intro is long. */
  private readonly startAt: number;
  /** Notes that end a long empty stretch: the «3 · 2 · 1» counts to them. */
  private readonly gapTimes: number[];
  /** First-meeting cards still owed to the player (null when none are). */
  private readonly meets: MeetTracker | null;
  private readonly deltas: number[] = [];
  /** The wide latency probe, until it settles (once per session). */
  private readonly probe: OffsetProbe | null;
  private probeSettled = false;
  private autoAdjust = 0;
  private hitsSeen = 0;
  private bassEnv = 0;
  private lastTimeReport = -Infinity;
  /** Walks `chart.beats` so the background can pulse on every beat (stronger on downbeats). */
  private readonly beatCursor: BeatCursor;
  /** Reused every frame for the spectrum skyline — the only spectrum buffer on the game side. */
  private readonly bands = new Uint8Array(SPECTRUM_BANDS);

  constructor(private readonly opts: SessionOptions) {
    this.clock = new Clock(() => audioEngine.now(), opts.userOffset, audioEngine.outputLatency());
    this.offsetTarget = opts.userOffset;
    this.notes = new NoteManager(undefined, { assistWindow: opts.touch && opts.touchAssist ? ASSIST_WINDOW : 0, approachTime: this.approachTime });
    const level = opts.chart.chart;
    const all = parseChartLevel(level);
    this.startAt = opts.pacing === false ? 0 : introStart(all);
    const parsed = notesFrom(all, this.startAt);
    this.parsed = parsed;
    this.gapTimes = opts.pacing === false ? [] : gapReturns(parsed, this.startAt);
    const plan = opts.seenKinds ? planMeetings(parsed, opts.seenKinds, beatSeconds(opts.chart)) : [];
    this.meets = plan.length > 0 ? new MeetTracker(plan) : null;
    this.sections = parseSections(level);
    this.notes.load(parsed);
    this.probe = opts.offsetProbe ? new OffsetProbe(parsed, opts.offsetProbe) : null;
    this.switchTimes = this.sections.map((sec, i) => {
      if (i === 0) return 0;
      let lastEnd = -Infinity;
      for (const n of parsed) if (n.time < sec.time) lastEnd = Math.max(lastEnd, n.time + n.duration);
      return Math.max(sec.time - this.approachTime, lastEnd + 0.15);
    });
    // A run is the chart played once per level: the totals (full combo, timeline capacity) span them all.
    const judgements = countJudgements(parsed) * this.levelCount;
    this.scoring = new Scoring(judgements);
    this.timeline = new JudgementTimeline(judgements);
    this.endTime = Math.min(opts.audioBuffer.duration, this.notes.lastTime + 1.5);
    // Per-track look: by genre when the chart carries one, otherwise deterministic from the id.
    // A catalog track with a picture plays in the theme that matches the poster's mood; custom songs and
    // tracks without a picture keep the genre theme.
    const meta = findTrack(opts.chart.id);
    const theme = meta?.tint ? themeForMood(meta.tint, opts.chart.genre, opts.chart.id) : themeFor(opts.chart.genre, opts.chart.id);
    this.renderer = new Renderer(
      opts.canvas,
      opts.touch,
      this.sections.map((s) => s.lanes),
      theme,
    );
    this.renderer.setLanes(this.lanesAt(this.startAt), true);
    this.renderer.setSongMap(songMap(opts.chart, this.endTime, this.startAt));
    this.beatCursor = new BeatCursor(opts.chart.beats, opts.chart.bpm, opts.chart.offset, opts.chart.duration);
    if (opts.fxMode === 'on') this.renderer.setFxLevel('low');
    else if ((opts.fxMode ?? 'auto') === 'auto' && opts.fxAuto === 'low') this.renderer.setFxLevel('low', true);
    this.input = new Input({
      audioNow: () => audioEngine.now(),
      laneForKey: (code) => (code === CIRCLE_KEY ? CIRCLE_BUCKET : (KEY_LAYOUTS[this.renderer.lanes]?.[code] ?? -1)),
      laneAt: (x, y) => {
        const r = opts.canvas.getBoundingClientRect();
        const px = x - r.left;
        const py = y - r.top;
        if (this.spinStarted) return SPIN_BUCKET; // the wheel is running: every finger belongs to it (before that, lane tiles are still landing)
        if (this.circleAt(px, py)) return CIRCLE_BUCKET;
        return laneAtPoint(this.renderer.layout, px, py, opts.touch);
      },
    });
    this.notes.onJudge = this.handleJudge;
    this.notes.onSkip = () => {
      if (!this.finished) this.scoring.forgive();
    };
    this.notes.onRollTap = (note) => {
      sfxHit(1);
      this.renderer.rollTap(note.lane, note.lanes, note.taps, note.extra);
    };
    this.resizeObserver = new ResizeObserver(() => this.renderer.resize());
    this.resizeObserver.observe(opts.canvas);
  }

  /**
   * New gem layout for this pass: 3–5 plain taps spread over the song (one of them the big gem) on
   * each of the three levels, three small ones on an endless loop past them. Seeded per pass.
   */
  private rollGems(): void {
    if (this.opts.gems === false) {
      this.notes.setGems([]);
      return;
    }
    const seed = this.opts.gemSeed ?? (Math.random() * 0x100000000) >>> 0;
    this.notes.setGems(this.level > LEVELS ? pickLoopGems(this.parsed, seed) : pickGems(this.parsed, seed, this.opts.audioBuffer.duration));
  }

  /** The lane count at song time `t` (sections take over at their switch times). */
  private lanesAt(t: number): number {
    return this.sections[Math.max(0, lowerBound(this.switchTimes, t + 1e-9) - 1)].lanes;
  }

  /** Levels in a run: three, or one when levels are off (the tutorial). */
  private get levelCount(): number {
    return this.opts.levels === false ? 1 : LEVELS;
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
      if (n.time - songTime > this.notes.circleEarly) continue; // closed circle: a tap there is still a lane tap
      const L = this.renderer.layoutFor(n.lanes);
      const { x: cx, y: cy } = circlePos(L, n.seq);
      const r = circleRadius(L) * 1.8;
      if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r) return true;
    }
    return false;
  }

  start(): void {
    if (this.destroyed) return;
    this.input.attach(this.opts.canvas, {
      onPress: this.onPress,
      onRelease: this.onRelease,
      onPointerDown: (e) => this.spinPointer('down', e),
      onPointerMove: (e) => this.spinPointer('move', e),
      onPointerUp: (e) => this.spinPointer('up', e),
    });
    this.restart();
  }

  /** Zero-friction restart: the whole run from level 1 — score, stars and crystals start over; the track stays decoded. */
  restart(): void {
    if (this.destroyed) return;
    window.clearTimeout(this.failTimer);
    window.clearTimeout(this.reviveTimer);
    this.pauseWanted = false;
    this.heartsOut = false;
    this.reviving = false;
    this.reviveUsed = false;
    this.scoring.reset();
    this.timeline.reset();
    this.lives.reset();
    this.renderer.particles.clear();
    this.renderer.cancelStarShow();
    this.perfectStreak = 0;
    this.crystals = 0;
    this.starsEarned = 0;
    this.crownsEarned = 0;
    this.scoreAtStars = -1;
    this.startLevel(1);
  }

  /** One pass of the song at its level's speed: notes, hearts and spells start afresh; the run's score, stars and crystals carry on. */
  private startLevel(level: number): void {
    if (this.destroyed) return;
    window.clearTimeout(this.levelTimer);
    audioEngine.stop();
    this.level = level;
    this.baseRate = levelRate(level);
    this.notes.timeScale = this.baseRate; // hit windows stay real seconds on a faster level
    this.betweenLevels = false;
    this.audioEnded = false;
    this.notes.reset();
    if (level <= LEVELS) this.lives.refill(); // an endless loop plays on with the hearts that are left
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
    this.gemAt = -1;
    this.spinNote = null;
    this.spin.reset();
    this.spinBonus = 0;
    this.spinBonusAt = -1;
    this.spinStarted = false;
    this.autoNext = 0;
    this.autoDue = [];
    this.rollGems();
    this.probe?.rearm();
    if (this.meets?.clear()) this.opts.onEvent({ type: 'meet', card: null });
    this.beatCursor.reset();
    this.renderer.setLanes(this.lanesAt(this.startAt), true);
    // The song starts at `startAt` (0, or past a skipped intro) after the count-in; the clock is anchored on that instant.
    const begin = audioEngine.play(this.opts.audioBuffer, this.startAt, () => (this.audioEnded = true), LEAD_IN) + this.startAt;
    this.clock.start(begin, this.startAt, this.baseRate);
    audioEngine.setPlaybackRate(this.baseRate);
    if (level > 1) audioEngine.fadeIn(FADE_IN_SEC, begin);
    this.opts.onEvent(level === 1 ? { type: 'start' } : { type: 'level', level });
    cancelAnimationFrame(this.raf);
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    if (this.pauseWanted) {
      // The tab was hidden during the star show: the new level waits in its count-in.
      this.pauseWanted = false;
      this.pause();
    }
  }

  pause(): void {
    if (this.betweenLevels) {
      this.pauseWanted = true;
      return;
    }
    if (!this.started || this.paused || this.finished) return;
    this.paused = true;
    this.clock.pause();
    audioEngine.pause();
    this.opts.onEvent({ type: 'pause', score: this.scoring.score, accuracy: this.scoring.accuracy, level: this.level });
  }

  resume(): void {
    // The revive offer and its count-in are frozen states of their own: Esc / the pause chip do not end them.
    if (!this.paused || this.heartsOut || this.reviving) return;
    // After a phone call or a long background the context is "interrupted"/suspended: its clock stands
    // still, so starting the song now would freeze the run. Resume the context first — this call comes
    // from a tap, so the browser allows it — and start only once it actually runs.
    const ctx = audioEngine.context;
    if (ctx && ctx.state !== 'running') {
      void audioEngine.ensureContext().then(() => {
        if (this.paused && !this.destroyed && audioEngine.context?.state === 'running') this.resumeAt(this.clock.position() - 1);
      });
      return;
    }
    this.resumeAt(this.clock.position() - 1);
  }

  /** The revive offer is open (field frozen, music paused, fail deferred). */
  get isHeartsOut(): boolean {
    return this.heartsOut;
  }

  /**
   * Hearts ran out but a revive can be offered: freeze like a pause, tell the host and wait —
   * `revive()` or `declineRevive()` continue from here. Once per run.
   */
  private freezeHeartsOut(): void {
    if (this.finished || this.heartsOut) return;
    this.heartsOut = true;
    this.paused = true;
    this.clock.pause();
    audioEngine.pause();
    audioEngine.missEffect();
    this.opts.onEvent({ type: 'hearts-out', score: this.scoring.score, accuracy: this.scoring.accuracy, level: this.level });
  }

  /**
   * The second chance is granted (the rewarded ad ended, or NEON PASS): five hearts back, the HUD
   * hearts pop in one by one, the «3 / 2 / 1» runs, and the song goes on from one second before the
   * freeze (`REVIVE_RESUME_AT`). The field does not move until then — not a note is skipped.
   */
  revive(): void {
    if (!this.heartsOut || this.destroyed) return;
    this.heartsOut = false;
    this.reviving = true;
    this.reviveUsed = true;
    this.reviveAge = 0;
    this.lives.reset();
    if (this.lives.max !== REVIVE_HEARTS) this.lives.hearts = REVIVE_HEARTS;
    this.heartLostAt = -1;
    this.opts.onEvent({ type: 'revive' });
    window.clearTimeout(this.reviveTimer);
    this.reviveTimer = window.setTimeout(() => {
      if (this.destroyed || !this.reviving) return;
      this.reviving = false;
      this.resumeAt(this.clock.position() - 1);
    }, REVIVE_RESUME_AT * 1000);
  }

  /** No second chance (declined, timed out, the ad closed early or failed): the run fails as it always did. */
  declineRevive(): void {
    if (!this.heartsOut) return;
    this.heartsOut = false;
    this.reviveUsed = true;
    this.paused = false;
    this.fail();
  }

  /**
   * Autoplay: hit every note on its time through the ordinary press / release path (judged like a
   * player's tap), release holds at their end, tap rolls evenly, land slides in their end lane, tap
   * circles, and turn a running spinner. Nothing else in the session knows it is not a finger.
   */
  private autoplay(songTime: number): void {
    const notes = this.parsed;
    while (this.autoNext < notes.length && notes[this.autoNext].time <= songTime) {
      const n = notes[this.autoNext++];
      if (n.kind === 'spin') continue;
      const bucket = n.kind === 'circle' ? CIRCLE_BUCKET : n.lane;
      if (n.kind === 'roll') {
        const taps = Math.max(1, n.extra);
        for (let k = 0; k < taps; k++) {
          const at = n.time + (n.duration * k) / taps;
          this.autoDue.push({ bucket, at, press: true }, { bucket, at: at + 0.04, press: false });
        }
        continue;
      }
      this.notes.press(bucket, n.time);
      if (bucket < MAX_LANES) this.renderer.pressFeedback(bucket);
      const end = n.time + Math.max(n.duration, 0.05);
      if (n.kind === 'slide') this.autoDue.push({ bucket: n.extra, at: end - 0.03, press: true }, { bucket: n.extra, at: end + 0.05, press: false });
      this.autoDue.push({ bucket, at: end, press: false });
    }
    if (this.autoDue.length) {
      this.autoDue.sort((a, b) => a.at - b.at);
      while (this.autoDue.length && this.autoDue[0].at <= songTime) {
        const d = this.autoDue.shift()!;
        if (d.press) {
          this.notes.press(d.bucket, d.at);
          if (d.bucket < MAX_LANES) this.renderer.pressFeedback(d.bucket);
        } else this.notes.release(d.bucket, d.at);
      }
    }
    if (this.spinStarted) {
      this.spin.tap(songTime);
      this.syncSpin(songTime);
    }
  }

  /** Dev (no-fail sessions, `window.__neon.seek(sec)`): jump the song; notes before the point are auto-missed. */
  seek(songTime: number): void {
    if (!this.started || this.finished) return;
    if (!this.paused) this.pause();
    this.resumeAt(Math.max(this.startAt, songTime));
  }

  private resumeAt(pos: number): void {
    this.playFrom(pos);
    this.paused = false;
    this.opts.onEvent({ type: 'resume' });
  }

  /**
   * Rewind the song to `songTime` while it plays (a tutorial step plays once more): the notes from there
   * on are armed again, the ones before put away unjudged, and the music goes on from there after a
   * short lead. Nothing happens while paused, frozen, between levels or once the run is over.
   */
  rewind(songTime: number): void {
    if (!this.started || this.paused || this.finished || this.destroyed) return;
    const t = Math.max(this.startAt, songTime);
    this.notes.rearmFrom(t);
    this.probe?.rearm();
    this.spinNote = null;
    this.spin.reset();
    this.spinBonus = 0;
    this.spinBonusAt = -1;
    this.spinStarted = false;
    this.autoNext = this.parsed.findIndex((n) => n.time >= t);
    if (this.autoNext < 0) this.autoNext = this.parsed.length;
    this.autoDue = [];
    this.audioEnded = false;
    this.playFrom(t);
  }

  /** Start the song at position `pos` (a short lead; before the level's start, the count-in's) with the clock on it and the slow spell off. */
  private playFrom(pos: number): void {
    // play() returns the audio-clock instant of song position 0 at rate 1; the clock is anchored on the
    // instant the source actually starts (`startTime + from`) at that position, so a faster level resumes in
    // step. A position before the level's start (paused in the count-in) keeps its lead so the first tiles still fall the whole way.
    const from = Math.max(this.startAt, pos);
    const startTime = audioEngine.play(this.opts.audioBuffer, from, () => (this.audioEnded = true), 0.3 + Math.max(0, this.startAt - pos) / this.baseRate);
    this.clock.start(startTime + from, from, this.baseRate);
    audioEngine.setPlaybackRate(this.baseRate);
    this.slowUntil = -1;
    this.slowReleasing = false;
    audioEngine.tapeEffect(false, 0.01);
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
    window.clearTimeout(this.failTimer);
    window.clearTimeout(this.levelTimer);
    window.clearTimeout(this.reviveTimer);
    cancelAnimationFrame(this.raf);
    this.input.detach();
    this.resizeObserver?.disconnect();
    audioEngine.stop();
  }

  private onPress = ({ lane, audioTime, viaMove }: { lane: number; audioTime: number; viaMove?: boolean }): void => {
    if (!this.started || this.paused || this.finished) return;
    if (lane < MAX_LANES) this.renderer.pressFeedback(lane);
    if (viaMove) return; // a finger sliding into a lane is not a new tap
    const songTime = this.clock.toSongTime(audioTime);
    // Keyboard fallback for the spinner: mashing lane keys turns the wheel a little.
    if (lane < MAX_LANES && this.spinStarted) {
      this.spin.tap(songTime);
      this.syncSpin(songTime);
      return;
    }
    // Every press near a note — a hit or an empty one — tells the probe how late this player hears the music.
    if (this.probe && !this.probeSettled && this.probe.press(lane, songTime, this.clock.rateAt(audioTime), this.clock.userOffset)) this.settleProbe();
    this.notes.press(lane, songTime);
  };

  /** The probe's samples agree: its median becomes the offset at once (it glides in, see frame()), and the host saves it. */
  private settleProbe(): void {
    const offset = this.probe?.settled() ?? null;
    if (offset === null) return;
    this.probeSettled = true;
    this.offsetTarget = clamp(offset, -AUTO_TOTAL_MAX, AUTO_TOTAL_MAX);
    // The in-run learner's half-steps start over from the probe's value.
    this.autoAdjust = 0;
    this.deltas.length = 0;
    this.opts.onEvent({ type: 'offset', offsetMs: Math.round(this.offsetTarget * 1000) });
  }

  /** A pointer down / move / up: while a spinner is on screen it turns the wheel. */
  private spinPointer(phase: 'down' | 'move' | 'up', e: { pointerId: number; x: number; y: number; audioTime: number }): void {
    if (!this.started || this.paused || this.finished) return;
    if (phase === 'up') {
      this.spin.up(e.pointerId);
      return;
    }
    const note = this.spinNote;
    if (!note) return;
    const r = this.opts.canvas.getBoundingClientRect();
    const songTime = this.clock.toSongTime(e.audioTime);
    if (phase === 'down') this.spin.down(e.pointerId, e.x - r.left, e.y - r.top, songTime);
    else this.spin.move(e.pointerId, e.x - r.left, e.y - r.top, songTime);
    this.syncSpin(songTime);
  }

  /** Copy the wheel into the note and pay every full revolution beyond the required ones. */
  private syncSpin(songTime: number): void {
    const note = this.spinNote;
    if (!note || !this.spinStarted) return;
    note.spin = this.spin.revolutions;
    const extra = Math.floor(note.spin - note.extra);
    const bonus = Math.max(0, extra) * SPIN_BONUS_PER_REV;
    if (bonus > this.spinBonus) {
      this.scoring.addBonus(bonus - this.spinBonus);
      this.spinBonus = bonus;
      this.spinBonusAt = songTime;
      sfxHit(0);
    }
  }

  /** Per frame: which spinner is on screen; a new one resets the wheel and takes the current geometry. */
  private trackSpin(songTime: number): void {
    let note = this.notes.activeSpin(songTime, this.approachTime);
    // Keep the finished wheel on screen for its fade.
    const prev = this.spinNote;
    if (!note && prev && prev.state === NoteState.Released && songTime - prev.endTime < SPIN_FADE_SEC) note = prev;
    if (note !== this.spinNote) {
      this.spinNote = note;
      this.spin.reset();
      this.spinBonus = 0;
      this.spinBonusAt = -1;
      this.spinStarted = false;
    }
    if (!note) return;
    const g = spinGeometry(this.renderer.layoutFor(note.lanes));
    this.spin.cx = g.x;
    this.spin.cy = g.y;
    this.spin.radius = g.r;
    // The wheel only counts from the spinner's start: whatever was circled during the approach is dropped.
    if (note.state === NoteState.Holding && !this.spinStarted) {
      this.spinStarted = true;
      this.spin.reset();
    }
  }

  private spinFrame(songTime: number): SpinFrame | null {
    const note = this.spinNote;
    if (!note) return null;
    const done = note.state === NoteState.Released;
    return {
      approach: note.state === NoteState.Pending ? (note.time - songTime) / this.approachTime : -1,
      fade: done ? clamp(1 - (songTime - note.endTime) / SPIN_FADE_SEC, 0, 1) : 1,
      revolutions: note.spin,
      required: note.extra,
      bonus: this.spinBonus,
      bonusAge: this.spinBonusAt < 0 ? Infinity : songTime - this.spinBonusAt,
      rate: this.spin.rate(songTime),
    };
  }

  private onRelease = ({ lane, audioTime }: { lane: number; audioTime: number }): void => {
    if (!this.started || this.finished) return;
    // A release is never dropped, paused or not: a finger that lifted must not be credited as still holding.
    this.notes.release(lane, this.clock.toSongTime(this.paused ? this.clock.toAudioTime(this.clock.judgeTime()) : audioTime));
  };

  private handleJudge = ({ note, judgement, tail }: JudgeEvent): void => {
    if (this.finished) return;
    const prevCombo = this.scoring.combo;
    const before = this.scoring.score;
    this.scoring.register(judgement, note.kind !== 'spin'); // a failed spinner counts for accuracy but leaves the combo alone
    this.lastGain = this.scoring.score - before;
    this.lastJudgement = judgement;
    this.lastJudgementAt = this.clock.songTime();
    this.timeline.record(this.lastJudgementAt + (this.level - 1) * this.opts.audioBuffer.duration, judgement, this.scoring.combo);
    // An untouched long note misses twice (head, tail) for accuracy, but costs one heart and one effect.
    if (judgement === 'miss' && tail && note.judgement === 'miss') {
      this.opts.onEvent({ type: 'judge', judgement, combo: this.scoring.combo });
      return;
    }
    if (note.kind === 'spin') {
      // A spinner is its own thing: its verdict counts for score and accuracy, but a failed one
      // costs no heart and touches no other mechanic.
      this.renderer.spinDone(judgement);
      if (judgement === 'miss') {
        this.perfectStreak = 0;
        sfxMiss();
      } else {
        sfxHit(judgement === 'perfect' ? 0 : 1);
        this.comboGrewAt = this.lastJudgementAt;
      }
      this.opts.onEvent({ type: 'judge', judgement, combo: this.scoring.combo });
      return;
    }
    this.renderer.hitFeedback(note.lane, note.lanes, judgement, note.kind === 'circle' ? note.seq : 0);

    if (judgement === 'miss') {
      audioEngine.missEffect();
      this.perfectStreak = 0;
      if (prevCombo >= 10) sfxComboBreak();
      else sfxMiss();
      if (prevCombo >= 10) {
        this.comboBreakAt = this.lastJudgementAt;
        const L = this.renderer.layout;
        this.renderer.comboBreak(L.laneX + L.laneAreaWidth / 2, this.renderer.comboAnchorY, prevCombo);
        this.opts.onEvent({ type: 'combo-break', combo: prevCombo });
      }
      const dead = this.lives.miss();
      if (!this.opts.hideHearts) {
        this.heartLostAt = this.lastJudgementAt;
        this.renderer.heartLost(this.lives.hearts, MAX_HEARTS);
        this.opts.onEvent({ type: 'life-lost', hearts: this.lives.hearts });
      }
      this.opts.onEvent({ type: 'judge', judgement, combo: this.scoring.combo });
      if (dead && !this.opts.noFail && !this.opts.hideHearts) {
        // No NEON PASS and no ad to show: the run simply ends, nothing is dangled.
        if (canOfferRevive(this.reviveUsed, this.opts.revive !== false) && (this.opts.canRevive?.() ?? true)) this.freezeHeartsOut();
        else this.fail();
      }
      return;
    }

    if (!tail) {
      sfxHit(judgement === 'perfect' ? 0 : judgement === 'great' ? 1 : 2);
      // Only a plain lane tap says something about the player's timing (circles open half a second early, assists are synthetic).
      if (!note.assisted && !note.kind && Math.abs(note.hitDelta) <= HIT_WINDOWS.good) this.learnOffset(note.hitDelta / this.clock.rateAt()); // a tap bias is real seconds
    }
    this.comboGrewAt = this.lastJudgementAt;
    this.perfectStreak = judgement === 'perfect' ? this.perfectStreak + 1 : 0;
    if (this.perfectStreak > 0 && this.perfectStreak % 25 === 0) this.opts.onEvent({ type: 'perfect-streak', streak: this.perfectStreak });
    if (this.lives.hit() && !this.opts.hideHearts) this.opts.onEvent({ type: 'life-gained', hearts: this.lives.hearts });
    if ((note.kind === 'slow' || note.kind === 'heart') && !tail) this.castSpell(note.kind, note.lane, note.lanes);
    if (note.gem > 0 && !tail) {
      this.crystals += note.gem;
      this.gemAt = this.lastJudgementAt;
      this.renderer.gemCollected(note.lane, note.lanes, note.gem);
      sfxGem(note.gem > 1);
      this.opts.onEvent({ type: 'gem', value: note.gem, total: this.crystals });
    }
    const combo = this.scoring.combo;
    if (combo > 0 && combo % MILESTONE_EVERY === 0) {
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
    // The correction glides in over a few hundred ms (see frame()) so the judgement never jumps mid-stream.
    this.offsetTarget += applied;
    for (let i = 0; i < this.deltas.length; i++) this.deltas[i] -= applied;
  }

  private castSpell(kind: SpellKind, lane: number, lanes: number): void {
    this.renderer.spellFeedback(lane, lanes, kind);
    sfxRank();
    if (kind === 'slow') {
      const now = audioEngine.now();
      this.slowUntil = this.clock.songTime() + SLOW_DURATION;
      this.slowReleasing = false;
      this.clock.setRate(SLOW_RATE * this.baseRate, SLOW_RAMP_IN, now);
      audioEngine.setPlaybackRate(SLOW_RATE * this.baseRate, SLOW_RAMP_IN);
      audioEngine.tapeEffect(true, SLOW_RAMP_IN);
    } else if (this.lives.catchHeart()) this.opts.onEvent({ type: 'life-gained', hearts: this.lives.hearts });
    else {
      // Ten lives already (five shown, five gilded): the heart turns into crystals instead.
      this.crystals += HEART_OVERFLOW_CRYSTALS;
      this.gemAt = this.clock.songTime();
      this.renderer.gemCollected(lane, lanes, HEART_OVERFLOW_CRYSTALS);
      sfxGem(true);
      this.opts.onEvent({ type: 'gem', value: HEART_OVERFLOW_CRYSTALS, total: this.crystals });
    }
    this.opts.onEvent({ type: 'spell', kind });
  }

  private frame = (now: number): void => {
    if (this.destroyed) return;
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.fps.tick(dt);
    if (this.reviving) this.reviveAge += dt;

    // The device's output latency can change mid-song (a headset connects): keep the heard time honest.
    this.clock.deviceLatency = audioEngine.outputLatency();
    if (!this.paused) {
      const d = this.offsetTarget - this.clock.userOffset;
      const step = OFFSET_SLEW * dt;
      this.clock.userOffset += Math.abs(d) <= step ? d : Math.sign(d) * step;
    }
    // The context died under us (a call, an interruption): the audio clock is frozen, so pause instead of
    // showing a run that never moves — «Продолжить» brings the context back.
    if (!this.paused && !this.finished && this.started && !this.heartsOut && !this.reviving && audioEngine.context && audioEngine.context.state !== 'running')
      this.pause();
    const songTime = this.clock.songTime();
    if (this.opts.autoplay && !this.paused && !this.finished) this.autoplay(songTime);
    if (!this.paused && !this.finished) {
      const lanes = this.lanesAt(songTime);
      if (lanes !== this.renderer.lanes) {
        if (songTime > this.startAt) sfxLanes(lanes > this.renderer.lanes);
        this.renderer.setLanes(lanes, songTime <= this.startAt);
        this.opts.onEvent({ type: 'lanes', lanes });
      }
      if (this.slowUntil > 0 && !this.slowReleasing && songTime >= this.slowUntil - SLOW_RAMP_OUT * SLOW_RATE * this.baseRate) {
        this.slowReleasing = true;
        const t = audioEngine.now();
        this.clock.setRate(this.baseRate, SLOW_RAMP_OUT, t);
        audioEngine.setPlaybackRate(this.baseRate, SLOW_RAMP_OUT);
        audioEngine.tapeEffect(false, SLOW_RAMP_OUT);
      }
      if (this.slowUntil > 0 && songTime >= this.slowUntil) this.slowUntil = -1;
      this.notes.update(this.clock.judgeTime(), this.isHeld);
      this.trackSpin(songTime);
      const card = this.meets?.update(songTime);
      if (card !== undefined) this.opts.onEvent({ type: 'meet', card });
      // FPS watchdog (economy mode "auto"): sustained < 45 fps after the count-in → low FX level, once.
      if ((this.opts.fxMode ?? 'auto') === 'auto' && this.renderer.fx === 'full' && songTime > this.startAt && this.lowFps.tick(this.fps.fps, dt)) {
        this.renderer.setFxLevel('low', true);
        this.opts.onEvent({ type: 'fx-low' });
        if (this.opts.debug) console.info('[neon-tap] fps < 45 for 3 s → fx level "low" (economy mode: auto)');
      }
      // The run ends when the last window has closed — not when the buffer stops, which on a laggy
      // output happens before the last tiles have even been heard.
      if (songTime >= this.endTime || (this.audioEnded && this.clock.judgeTime() > this.notes.lastTime + HIT_WINDOWS.good)) this.levelDone();
    }
    // Effects keep moving through the star show between levels and the fail freeze.
    if (!this.paused) this.renderer.update(dt);
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
    // After a long empty stretch: «3 · 2 · 1» to the note that ends it (real seconds, the slow spell included).
    const gapLeft = this.gapTimes.length > 0 && !this.paused && !this.finished ? gapCountLeft(this.gapTimes, songTime, this.clock.rateAt()) : -1;
    this.renderer.draw(this.notes, {
      songTime,
      approachTime: this.approachTime,
      pulse,
      beatPhase: this.beatCursor.phase(songTime),
      combo: s.combo,
      comboAge: this.comboGrewAt < 0 ? Infinity : songTime - this.comboGrewAt,
      score: s.score,
      accuracy: s.accuracy,
      progress: Math.max(0, Math.min(1, (songTime - this.startAt) / Math.max(0.001, this.endTime - this.startAt))),
      start: this.startAt,
      gapLeft,
      caption: this.meets?.showing === true,
      hearts: this.lives.hearts,
      goldHearts: this.lives.gold,
      maxHearts: this.opts.hideHearts ? 0 : MAX_HEARTS,
      heartLostAge: this.heartLostAt < 0 ? Infinity : songTime - this.heartLostAt,
      slowRemaining: slowLeft > 0 ? Math.min(1, slowLeft / SLOW_DURATION) : -1,
      crystals: this.opts.gems === false ? -1 : this.crystals,
      gemAge: this.gemAt < 0 ? Infinity : songTime - this.gemAt,
      held: this.isHeld,
      lastJudgement: this.lastJudgement,
      lastJudgementAge: this.lastJudgementAt < 0 ? 1 : songTime - this.lastJudgementAt,
      lastGain: this.lastGain,
      comboBreakAge: this.comboBreakAt < 0 ? -1 : songTime - this.comboBreakAt,
      spin: this.spinFrame(songTime),
      levels: this.levelCount > 1 ? this.levelCount : 0,
      level: this.level,
      stars: this.starsEarned,
      crowns: this.crownsEarned,
      endless: this.endless,
      revive: this.reviving ? this.reviveAge : -1,
      hudHidden: this.failed && !this.reviving && !this.heartsOut,
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

    // The fail frame, the pause menu and the revive offer are DOM overlays (GameCanvas); the canvas
    // keeps the frozen field under them. The count-in is drawn here, over the first falling tiles.
    if (!this.failed && !this.paused && songTime < this.startAt) this.renderer.drawCountdown(this.startAt - songTime);
    this.raf = requestAnimationFrame(this.frame);
  };

  private isHeld = (lane: number): boolean => this.input.isHeld(lane);

  /** Endless mode is on and the run has levels to loop (a single-pass run cannot loop). */
  private get endless(): boolean {
    return this.opts.endless === true && this.levelCount > 1;
  }

  /**
   * Ends the run from the pause panel once it has something to keep (a level finished): the stars,
   * crowns and score so far are banked as if the hearts had run out — leaving must never cost them.
   */
  stop(): void {
    if (this.finished || !this.paused || this.level <= 1) return;
    this.paused = false;
    this.fail(true);
  }

  private fail(quiet = false): void {
    if (this.finished) return;
    this.failed = true;
    // Out of hearts past the first level: the run stops, but the stars stay («СТОП»); before it — «ПРОВАЛ».
    // In endless loops the end is the finale of a run that has already won everything: no miss sting;
    // `quiet` is a voluntary stop from the pause panel — no sting either.
    const finale = this.endless && this.level > LEVELS;
    if (finale) sfxRank();
    else if (!quiet) audioEngine.missEffect();
    const lost = levelOutcome(this.level, true, this.endless);
    this.opts.onEvent({ type: 'fail', stars: lost.stars, crowns: lost.crowns, finale });
    this.failTimer = window.setTimeout(() => this.finish(), FAIL_SHOW_SEC * 1000);
    this.finished = true;
    audioEngine.stop();
  }

  /**
   * The level's last window has closed: its star is won. With a level still to play, the song fades
   * out under the star show and comes back faster; after the last one the run is over.
   */
  private levelDone(): void {
    const { stars, crowns, next } = levelOutcome(this.level, false, this.endless);
    this.starsEarned = stars;
    this.crownsEarned = crowns;
    if (this.level === LEVELS) this.scoreAtStars = this.scoring.score;
    if (next === null || (next > this.levelCount && !this.endless)) {
      this.finish();
      return;
    }
    this.finished = true; // no taps, no judging until the next count-in
    this.betweenLevels = true;
    this.pauseWanted = false;
    audioEngine.fadeOut(FADE_OUT_SEC);
    sfxRank();
    // The third star opens the endless loops: the show says so instead of naming a level.
    this.renderer.starEarned(crowns > 0 ? { crown: crowns, loop: next } : { star: stars, opens: next > LEVELS }, levelRate(next), STAR_SHOW_SEC);
    this.opts.onEvent({ type: 'star', stars, crowns, next });
    this.levelTimer = window.setTimeout(() => this.startLevel(next), STAR_SHOW_SEC * 1000);
  }

  private finish(): void {
    if (this.destroyed) return;
    if (this.finished && !this.failed) return;
    this.finished = true;
    if (!this.failed) this.notes.update(Number.POSITIVE_INFINITY, () => false);
    const s = this.scoring;
    // Stars are levels finished; a fail past the first level keeps them, and the run counts.
    const { stars, crowns } = levelOutcome(this.level, this.failed, this.endless);
    this.starsEarned = stars;
    this.crownsEarned = crowns;
    const failed = this.failed && stars === 0;
    // Past the third star the score keeps growing loop after loop; the record and the leaderboard take
    // the score at the third star, so a three-level run and an endless one compare like with like.
    const looped = this.endless && this.level > LEVELS && this.scoreAtStars >= 0;
    const result: PlayResult = {
      trackId: this.opts.chart.id,
      score: looped ? this.scoreAtStars : s.score,
      accuracy: s.accuracy,
      rank: failed ? 'D' : s.rank,
      maxCombo: s.maxCombo,
      totalNotes: s.totalNotes,
      counts: { ...s.counts },
      fullCombo: !this.failed && s.isFullCombo,
      notesToS: notesToReach(s.counts, 0.95),
      failed,
      stars,
      crowns,
      endless: this.endless,
      level: this.level,
      hearts: this.lives.hearts,
      timeline: this.timeline.toResult(),
      duration: this.opts.audioBuffer.duration * this.level,
      crystals: this.crystals,
    };
    if (looped) result.endlessScore = s.score;
    // The learned offset is saved only when it moved, and never beyond what a tap bias can be — so it cannot drift run after run.
    const autoOffsetMs =
      this.opts.autoOffset && this.hitsSeen >= 60 && Math.abs(this.autoAdjust) >= 0.01
        ? Math.round(clamp(this.offsetTarget, -AUTO_TOTAL_MAX, AUTO_TOTAL_MAX) * 1000)
        : null;
    this.failed = false;
    this.opts.onEvent({ type: 'finish', result, autoOffsetMs });
  }
}
