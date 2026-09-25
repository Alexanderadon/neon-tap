import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { audioEngine, loadSong, preloadSfx, sfxUi, waitForAudioUnlock } from '@/shared/lib/audio';
import { formatAccuracy, formatScore } from '@/shared/lib/format';
import { navigate } from '@/shared/lib/router';
import { needsRotateHint } from '@/shared/lib/viewport';
import { dict, fmt, plural } from '@/shared/i18n';
import { hasDevFlag } from '@/shared/config/devFlags';
import {
  ActionZone,
  Chip,
  Disc,
  Headline,
  Heart,
  Icon,
  Line,
  ObjButton,
  Panel,
  PrimaryAction,
  RingCountdown,
  SegmentsPulse,
  Stars,
  Tag,
  Trio,
} from '@/shared/ui';
import type { ChartFile } from '@/shared/types/chart';
import { getSettings, updateSettings } from '@/entities/settings';
import { CoverScene, TrackCover, trackTint } from '@/entities/track';
import { isPassActive } from '@/entities/pass';
import { progressStore, spendCrystals } from '@/entities/progress';
import {
  GameSession,
  LEVELS,
  REFILL_AT,
  REVIVE_IDLE,
  REVIVE_OFFER_SEC,
  payForRevive,
  reviveAffordable,
  reviveArmed,
  revivePrice,
  reviveReducer,
  type SessionEvent,
} from '@/features/play-chart';
import { saveResult } from '@/features/save-result';
import { trackSpell } from '@/features/track-progress';
import { voice, praise } from '@/features/voice-feedback';
import type { ChartSource } from '@/entities/play-session';
import './game-canvas.css';

export type GameCanvasMode = 'play' | 'tutorial';

interface Props {
  chart: ChartFile;
  source: ChartSource;
  /** Pre-decoded audio for custom songs. */
  audioBuffer: AudioBuffer | null;
  /**
   * `play` (default): hearts, fail, result saved and the result screen opens on finish.
   * `tutorial`: no hearts / no fail, nothing is saved, `finish` is only reported via `onEvent`.
   */
  mode?: GameCanvasMode;
  /** Mirror of session events for the host page (tutorial captions). */
  onEvent?: (e: SessionEvent) => void;
  /** Song time at ~10 Hz (tutorial captions). */
  onTime?: (songTime: number) => void;
  /** Called instead of `navigate('menu')` when the player leaves through the pause menu. */
  onExit?: () => void;
  /** The top bar for the pause / loading / error overlays — the page passes `<TopBar />` (widgets never import widgets). */
  header?: ReactNode;
  /** «Глава 1» / «Рок-пак» — the catalog chapter's title for the pause menu; omitted for custom songs. */
  chapter?: string;
  /** HUD-level chrome of the host page (the tutorial caption card): lives over the field, hidden with the HUD under the pause / fail frames. */
  overlay?: ReactNode;
}

interface Snapshot {
  score: number;
  accuracy: number;
  level: number;
}

const isTouchDevice = () => matchMedia('(pointer: coarse)').matches;

/**
 * Hosts the canvas, owns the GameSession lifecycle and routes session events to voice/save.
 * Everything that is not the field is DOM chrome here: the pause chip on the HUD line, the pause
 * menu, loading / error, the fail frame, and the second-chance offer for 30 crystals (free with
 * NEON PASS; spec: screens-game.html).
 */
export function GameCanvas({ chart, source, audioBuffer, mode = 'play', onEvent, onTime, onExit, header, chapter, overlay }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const [status, setStatus] = useState<'loading' | 'tap' | 'ready' | 'error'>('loading');
  /** The song's download and decode, 0–100 (the loading tag's number). */
  const [loadPct, setLoadPct] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [paused, setPaused] = useState<Snapshot | null>(null);
  const [fail, setFail] = useState<{ stars: number; crowns: number; finale: boolean } | null>(null);
  const [revive, dispatch] = useReducer(reviveReducer, REVIVE_IDLE);
  /** When the second-chance offer opened (performance.now()): «Продолжить» is not armed before it has risen. */
  const offerAtRef = useRef<number | null>(null);
  const [muted, setMuted] = useState(false);
  // Latest host callbacks without re-creating the session when the parent re-renders.
  const hostRef = useRef({ onEvent, onTime, onExit });
  hostRef.current = { onEvent, onTime, onExit };
  const tutorial = mode === 'tutorial';
  // The review autoplayer (`?auto=1` on this page load): named in the pause panel so nobody wonders who is playing.
  const autoRun = hasDevFlag('auto');

  useEffect(() => {
    let cancelled = false;
    let session: GameSession | null = null;

    const handleEvent = (e: SessionEvent) => {
      hostRef.current.onEvent?.(e);
      switch (e.type) {
        case 'start':
          voice.say('poehali', true);
          setFail(null);
          setPaused(null);
          dispatch({ type: 'restart' });
          break;
        case 'combo-milestone':
          if (e.combo === 50) voice.say('combo-50', true);
          else if (e.combo === 100) voice.say('combo-100', true);
          else if (e.combo === 250) voice.say('combo-250', true);
          else if (e.combo === 500) voice.say('combo-500', true);
          else voice.say(praise(), true);
          break;
        case 'perfect-streak':
          voice.say('idealno');
          break;
        case 'combo-break':
          voice.say(e.combo >= 50 ? 'ne-sdavaysya' : 'mimo');
          break;
        case 'life-lost':
          if (e.hearts === 1) voice.say('ne-sdavaysya', true);
          break;
        case 'spell':
          if (!tutorial) trackSpell(e.kind); // the tutorial's spell does not count toward goals
          if (e.kind === 'slow') voice.say('ogon', true);
          break;
        case 'lanes':
          if (e.lanes >= 5) voice.say('tak-derzhat');
          break;
        case 'star':
          voice.say(praise(), true);
          break;
        case 'level':
          voice.say('poehali', true);
          break;
        case 'hearts-out':
          setPaused(null);
          offerAtRef.current = performance.now();
          dispatch({ type: 'hearts-out' });
          break;
        case 'revive':
          voice.say('poehali', true);
          break;
        case 'fail':
          setPaused(null);
          dispatch({ type: 'decline' });
          setFail({ stars: e.stars, crowns: e.crowns, finale: e.finale });
          break;
        case 'pause':
          setPaused({ score: e.score, accuracy: e.accuracy, level: e.level });
          break;
        case 'resume':
          setPaused(null);
          dispatch({ type: 'resumed' });
          break;
        case 'finish':
          if (tutorial) break; // the tutorial page decides what happens next
          if (e.autoOffsetMs !== null) updateSettings({ audioOffsetMs: e.autoOffsetMs });
          saveResult(e.result, source);
          navigate('result');
          break;
      }
    };

    setStatus('loading');
    setLoadPct(0);
    (async () => {
      try {
        await audioEngine.ensureContext();
        const settings = getSettings();
        audioEngine.setVolumes({ music: settings.musicVolume, sfx: settings.sfxVolume, voice: settings.voiceVolume });
        voice.setVoice(settings.voice);
        const song = audioBuffer ?? loadSong(`${import.meta.env.BASE_URL}${chart.audio}`, { onProgress: (f) => !cancelled && setLoadPct(Math.round(f * 100)) });
        const [buffer] = await Promise.all([song, preloadSfx(), voice.preload()]);
        if (cancelled || !canvasRef.current) return;
        // Sound needs one tap on the page. A run reached without any (the first-launch tutorial opens
        // on its own) waits for it instead of starting silent with a frozen clock.
        if (audioEngine.context?.state !== 'running') {
          setStatus('tap');
          await waitForAudioUnlock();
          if (cancelled || !canvasRef.current) return;
        }
        const autoFlag = hasDevFlag('auto');
        const noFailFlag = hasDevFlag('nofail') || autoFlag;
        session = new GameSession({
          chart,
          audioBuffer: buffer,
          canvas: canvasRef.current,
          userOffset: settings.audioOffsetMs / 1000,
          touch: isTouchDevice(),
          touchAssist: true,
          autoOffset: !tutorial,
          noFail: noFailFlag || tutorial,
          autoplay: autoFlag && !tutorial,
          hideHearts: tutorial,
          gems: !tutorial,
          levels: !tutorial,
          endless: !tutorial,
          // The second chance: never for an ad — 30 crystals, free with NEON PASS, and not offered at all without them.
          revive: !tutorial && !noFailFlag,
          canRevive: () => reviveAffordable(isPassActive(), progressStore.get().crystals),
          fxMode: settings.fxMode,
          debug: settings.debugOverlay,
          onEvent: handleEvent,
          onTime: tutorial ? (t) => hostRef.current.onTime?.(t) : undefined,
        });
        sessionRef.current = session;
        setStatus('ready');
        session.start();
        // Dev hook for automated checks: `?nofail=1` exposes the session on window.
        if (noFailFlag) (window as unknown as { __neon: GameSession }).__neon = session;
      } catch (err) {
        console.error(err);
        if (!cancelled) setStatus('error');
      }
    })();

    const onKey = (e: KeyboardEvent) => {
      const s = sessionRef.current;
      if (!s) return;
      if (e.code === 'KeyR') {
        e.preventDefault();
        s.restart();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        if (s.isPaused) s.resume();
        else s.pause();
      } else if (e.code === 'F9') {
        e.preventDefault();
        s.debugSlow();
      }
    };
    // Tab hidden / app switched away (installed PWA: home button, notification shade): pause.
    // Only the song source is stopped — the AudioContext stays alive so resume is instant and
    // needs no new user gesture. `freeze` / `pagehide` cover the Page Lifecycle paths where
    // Android may drop the process without a visibilitychange first.
    const onVisibility = () => {
      if (document.hidden) sessionRef.current?.pause();
      // Coming back: iOS may have suspended the context; the audio gate re-appears if so.
      else void audioEngine.ensureContext().catch(() => undefined);
    };
    const onHidden = () => sessionRef.current?.pause();
    // A phone rotated to landscape mid-song: the "rotate" overlay covers the field, so pause.
    const onResize = () => {
      if (needsRotateHint(isTouchDevice(), window.innerWidth, window.innerHeight)) sessionRef.current?.pause();
    };
    // iOS Safari ignores user-scalable=no: pinch-zoom is only stoppable by cancelling the gesture.
    const stopGesture = (e: Event) => e.preventDefault();
    const stopMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('freeze', onHidden);
    window.addEventListener('pagehide', onHidden);
    window.addEventListener('blur', onHidden); // a dialog / alt-tab mid-song: pause instead of breaking the held notes
    window.addEventListener('resize', onResize);
    document.addEventListener('gesturestart', stopGesture, { passive: false });
    document.addEventListener('touchmove', stopMultiTouch, { passive: false });

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('freeze', onHidden);
      window.removeEventListener('pagehide', onHidden);
      window.removeEventListener('blur', onHidden);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('gesturestart', stopGesture);
      document.removeEventListener('touchmove', stopMultiTouch);
      session?.destroy();
      sessionRef.current = null;
    };
  }, [chart, source, audioBuffer, mode, tutorial, attempt]);

  const exit = useCallback(() => (hostRef.current.onExit ? hostRef.current.onExit() : navigate('menu')), []);

  const toggleSound = () => {
    sfxUi();
    const next = !muted;
    setMuted(next);
    audioEngine.setVolumes({ music: next ? 0 : getSettings().musicVolume });
  };

  // --- second chance: the offer times out after 5 s; «Продолжить» pays 30 crystals (free with NEON PASS) ---
  const declineRevive = useCallback(() => {
    const s = sessionRef.current;
    dispatch({ type: 'decline' });
    if (s?.isHeartsOut) s.declineRevive();
  }, []);
  const acceptRevive = () => {
    const s = sessionRef.current;
    if (!s || !s.isHeartsOut || revive.phase !== 'offer') return;
    // A tap while the button is still rising is the finger that was hitting the lanes: it pays nothing.
    if (!reviveArmed(offerAtRef.current, performance.now())) return;
    sfxUi();
    // The wallet may have changed in another tab since the offer opened: nothing paid, no hearts.
    if (!payForRevive(isPassActive(), spendCrystals)) {
      declineRevive();
      return;
    }
    dispatch({ type: 'accept' });
    s.revive();
  };
  useEffect(() => {
    if (revive.phase !== 'offer') return;
    const t = window.setTimeout(declineRevive, REVIVE_OFFER_SEC * 1000);
    return () => window.clearTimeout(t);
  }, [revive.phase, declineRevive]);

  // «Metal Song · Глава 1» / «my-song · Моя музыка»; the tutorial has neither a chapter nor a file — its title stands alone.
  const subTail = chapter !== undefined ? chapter : mode === 'tutorial' ? null : dict.customSong;
  const subLine = (
    <div className="game-sub">
      <b>{chart.title}</b>
      {subTail !== null && (
        <>
          <span>·</span>
          {subTail}
        </>
      )}
    </div>
  );
  // The overlays' primary buttons wear the playing track's accent (custom songs keep the cyan).
  const tint = source === 'catalog' ? trackTint(chart.id, chart.genre) : undefined;
  const cover = (
    <div className="game-cover120" aria-hidden="true">
      <TrackCover id={chart.id} genre={chart.genre} />
    </div>
  );
  const skeleton = (children: ReactNode, bottom?: ReactNode) => (
    <div className="game-shade game-frame">
      <CoverScene id={chart.id} genre={chart.genre} />
      <div className="game-col">
        {header}
        {subLine}
        {cover}
        {children}
        {bottom && <ActionZone className="game-bottom">{bottom}</ActionZone>}
      </div>
    </div>
  );

  const showPause = paused !== null && revive.phase === 'idle' && status === 'ready';
  const hudVisible = status === 'ready' && !showPause && revive.phase === 'idle' && fail === null;

  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="game-canvas" />

      {hudVisible && (
        <Chip
          className="game-pause-chip"
          iconOnly
          icon={<Icon name="pause" size={20} />}
          aria-label={dict.pause}
          title={dict.pause}
          onClick={() => sessionRef.current?.pause()}
        />
      )}
      {hudVisible && overlay}

      {(status === 'loading' || status === 'tap') &&
        skeleton(
          <>
            <div className="game-tabline">
              <Tag variant="dark" shine className="game-tag-loading">
                {status === 'tap' ? dict.tapToStart : loadPct > 0 ? fmt(dict.loadingPercent, { n: loadPct }) : dict.loading}
              </Tag>
            </div>
            <SegmentsPulse count={10} className="game-segs" />
          </>,
        )}

      {status === 'error' &&
        skeleton(
          <>
            {/* An own song is a local file: «Не удалось прочитать файл», nothing about the connection. */}
            <div className="game-tabline">
              <Tag variant="mag">{source === 'custom' ? dict.readFileFailed : dict.loadFailed}</Tag>
            </div>
            <Line className="game-line">{source === 'custom' ? dict.readFileHint : dict.checkConnection}</Line>
          </>,
          <>
            <Trio className="game-trio">
              <ObjButton icon={<Icon name="home" />} label={dict.toMenu} onClick={exit} />
              <ObjButton icon={<Icon name="trophy" />} label={dict.records} onClick={() => navigate('menu', { view: 'records', track: chart.id })} />
              <ObjButton icon={<Icon name="user" />} label={dict.profile} onClick={() => navigate('menu', { view: 'profile' })} />
            </Trio>
            <PrimaryAction
              lead={
                <Disc>
                  <Icon name="retry" />
                </Disc>
              }
              label={dict.retry}
              tint={tint}
              sub={chart.title}
              beat
              onClick={() => setAttempt((n) => n + 1)}
            />
          </>,
        )}

      {showPause &&
        skeleton(
          <>
            <Headline as="div" pop className="game-verdict">
              {dict.paused}
            </Headline>
            <Panel layout="score" className="game-panel">
              <div className="game-score">{formatScore(paused.score)}</div>
              <div className="game-stats">
                <span>
                  {dict.accuracy} <b>{formatAccuracy(paused.accuracy)}</b>
                </span>
                {!tutorial && paused.level <= LEVELS && (
                  <span>
                    {dict.levelWord}{' '}
                    <b>
                      {paused.level} / {LEVELS}
                    </b>
                  </span>
                )}
                {!tutorial && paused.level > LEVELS && (
                  <span>
                    {dict.loopWord} <b>{paused.level}</b>
                  </span>
                )}
                {autoRun && !tutorial && <span>{dict.autoTag}</span>}
              </div>
            </Panel>
          </>,
          <>
            <Trio className="game-trio">
              <ObjButton
                icon={<Icon name="retry" />}
                label={dict.restart}
                onClick={() => {
                  sfxUi();
                  sessionRef.current?.restart();
                }}
              />
              <ObjButton icon={<Icon name="sound" />} label={dict.soundToggle} className={muted ? 'game-muted' : undefined} onClick={toggleSound} />
              {tutorial ? (
                <ObjButton icon={<Icon name="chevron" />} label={dict.tutorialSkip} onClick={exit} />
              ) : paused.level > 1 ? (
                // A level is already won: leaving must not throw it away, so the way out ends the run and banks it.
                <ObjButton
                  icon={<Icon name="stop" />}
                  label={dict.finishRun}
                  onClick={() => {
                    sfxUi();
                    sessionRef.current?.stop();
                  }}
                />
              ) : (
                <ObjButton icon={<Icon name="home" />} label={dict.exit} onClick={exit} />
              )}
            </Trio>
            <PrimaryAction
              lead={
                <Disc>
                  <Icon name="play" />
                </Disc>
              }
              label={dict.resume}
              tint={tint}
              sub={chart.title}
              beat
              autoFocus
              onClick={() => sessionRef.current?.resume()}
            />
          </>,
        )}

      {fail !== null && <FailFrame stars={fail.stars} crowns={fail.crowns} finale={fail.finale} />}

      {revive.phase !== 'idle' && <ReviveFrame phase={revive.phase} pass={isPassActive()} tint={tint} onAccept={acceptRevive} onDecline={declineRevive} />}
    </div>
  );
}

/**
 * «ПРОВАЛ» (no stars), «СТОП — звёзд заработано: N» or, past the third star of an endless run,
 * «ФИНИШ — корон заработано: N»: a ≤ 1.5 s frame over the frozen field before the result.
 */
function FailFrame({ stars, crowns, finale }: { stars: number; crowns: number; finale: boolean }) {
  return (
    <div className="game-shade game-fail" aria-live="polite">
      <div className="game-col">
        <div className="game-hero">
          <Stars value={stars} crowns={Math.min(3, crowns)} size="hero" animate />
        </div>
        <Headline as="div" pop tone={stars > 0 ? 'gold' : 'mag'} className="game-verdict game-verdict-late">
          {finale ? dict.finale : stars > 0 ? dict.levelStop : dict.failed}
        </Headline>
        <div className="game-tabline game-tabline-late">
          {crowns > 0 ? (
            <Tag>{fmt(dict.crownsKept, { n: crowns })}</Tag>
          ) : stars > 0 ? (
            <Tag>{fmt(dict.levelKept, { n: stars })}</Tag>
          ) : (
            <Tag variant="dark">{dict.heartsOut}</Tag>
          )}
        </div>
      </div>
    </div>
  );
}

interface ReviveProps {
  phase: 'offer' | 'refill';
  /** NEON PASS: the second chance is free. */
  pass: boolean;
  /** The playing track's accent for «ПРОДОЛЖИТЬ». */
  tint?: string;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * The second-chance offer (frame 20): five empty hearts in a panel, «СЕРДЦА КОНЧИЛИСЬ», «ПРОДОЛЖИТЬ
 * · +5 сердец · 30 кристаллов» (free with NEON PASS) with a 5 s ring, «К результату». It only opens
 * when the wallet can pay. «Продолжить» is not focused (Space is the circle key) and takes a tap only
 * once it has risen (`REVIVE_ARM_MS`). After «Продолжить» (frame 21) the hearts pop back with sparks and the
 * canvas counts «3 / 2 / 1» under a light veil.
 */
function ReviveFrame({ phase, pass, tint, onAccept, onDecline }: ReviveProps) {
  const [left, setLeft] = useState(REVIVE_OFFER_SEC);
  useEffect(() => {
    if (phase !== 'offer') return;
    setLeft(REVIVE_OFFER_SEC);
    const started = performance.now();
    const t = window.setInterval(() => setLeft(Math.max(0, REVIVE_OFFER_SEC - Math.floor((performance.now() - started) / 1000))), 200);
    return () => window.clearInterval(t);
  }, [phase]);
  const refill = phase === 'refill';
  const cost = revivePrice(pass);
  const price = cost === 0 ? dict.reviveFree : fmt(dict.revivePrice, { n: cost, noun: plural(cost, dict.crystalsNoun) });
  return (
    <div className={refill ? 'game-frame game-revive game-revive-fill' : 'game-shade game-frame game-revive'} aria-live="polite">
      <div className="game-col">
        <div className="game-tabline game-tabline-revive">
          <Tag variant="dark">{dict.reviveOnce}</Tag>
        </div>
        <Panel layout="score" className="game-panel game-panel-revive">
          <div className="game-hearts40">
            {REFILL_AT.map((delay, i) => (
              <span key={i} className="game-hs" style={{ '--d': `${delay}s` } as CSSProperties}>
                <Heart state="off" />
                {refill && (
                  <>
                    <Heart state="on" className="game-hs-on" />
                    <span className="game-sparks" aria-hidden="true">
                      {Array.from({ length: 8 }, (_, k) => (
                        <i
                          key={k}
                          className={k % 2 === 0 ? 'game-spark game-spark-gold' : 'game-spark'}
                          style={{ '--a': `${-5 + k * 46}deg`, '--l': `${30 + k}px` } as CSSProperties}
                        />
                      ))}
                    </span>
                  </>
                )}
              </span>
            ))}
          </div>
          <Line className="game-line">
            {refill ? (
              <>
                <b>{dict.revived}</b> · {dict.samePlace}
              </>
            ) : (
              dict.reviveHint
            )}
          </Line>
        </Panel>
        {!refill && (
          <Headline as="div" pop className="game-verdict game-verdict-sm">
            {dict.heartsOut}
          </Headline>
        )}
        {!refill && (
          <ActionZone className="game-bottom">
            <Trio one className="game-trio">
              <ObjButton icon={<Icon name="arrow" />} label={dict.toResult} onClick={onDecline} />
            </Trio>
            <PrimaryAction
              lead={
                <Disc>
                  <Icon name="tray" />
                </Disc>
              }
              label={dict.continue}
              tint={tint}
              sub={fmt(dict.reviveSubPrice, { price })}
              beat
              icon={
                <RingCountdown size={40} seconds={REVIVE_OFFER_SEC} className="game-ring" track>
                  {left}
                </RingCountdown>
              }
              onClick={onAccept}
            />
          </ActionZone>
        )}
      </div>
    </div>
  );
}
