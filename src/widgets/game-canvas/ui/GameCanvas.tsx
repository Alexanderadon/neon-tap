import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { audioEngine, loadSong, preloadSfx, sfxUi, waitForAudioUnlock } from '@/shared/lib/audio';
import { formatAccuracy, formatScore } from '@/shared/lib/format';
import { ads, isStubAds, stubAds, useStubAdProgress } from '@/shared/lib/ads';
import { navigate } from '@/shared/lib/router';
import { needsRotateHint } from '@/shared/lib/viewport';
import { dict, fmt } from '@/shared/i18n';
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
import {
  GameSession,
  LEVELS,
  REFILL_AT,
  REVIVE_IDLE,
  REVIVE_OFFER_SEC,
  reviveArmed,
  reviveAvailable,
  reviveKeysLocked,
  reviveStep,
  watchReviveAd,
  type ReviveAction,
  type ReviveState,
  type SessionEvent,
} from '@/features/play-chart';
import { saveResult } from '@/features/save-result';
import { trackSpell } from '@/features/track-progress';
import { voice, praise } from '@/features/voice-feedback';
import type { ChartSource } from '@/entities/play-session';
import { reviveButton } from '../model/reviveButton';
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
 * menu, loading / error, the fail frame, and the second-chance offer — for a rewarded ad, free with
 * NEON PASS, never for crystals (spec: screens-game.html).
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
  const [revive, setRevive] = useState<ReviveState>(REVIVE_IDLE);
  /** The same state for what runs outside a render: session events, the offer's timer, the ad's end. */
  const reviveRef = useRef<ReviveState>(REVIVE_IDLE);
  /** When the second-chance offer opened (performance.now()): the primary button is not armed before it has risen. */
  const offerAtRef = useRef<number | null>(null);
  /**
   * Advance the second chance and do what it asks of the session: the hearts back (the ad's reward,
   * or NEON PASS) or the end of the run. The ad itself plays from the effect below while the phase is 'ad'.
   */
  const stepRevive = useCallback((action: ReviveAction) => {
    const { state, effect } = reviveStep(reviveRef.current, action);
    if (state !== reviveRef.current) {
      reviveRef.current = state;
      setRevive(state);
    }
    const s = sessionRef.current;
    if (effect === 'revive') s?.revive();
    else if (effect === 'fail') s?.declineRevive(); // a no-op once the session has failed on its own
  }, []);
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
          stepRevive({ type: 'restart' });
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
          // NEON PASS is read once for the offer: the button's words and what it does never disagree.
          stepRevive({ type: 'hearts-out', pass: isPassActive() });
          break;
        case 'revive':
          voice.say('poehali', true);
          break;
        case 'fail':
          setPaused(null);
          stepRevive({ type: 'decline' });
          setFail({ stars: e.stars, crowns: e.crowns, finale: e.finale });
          break;
        case 'pause':
          setPaused({ score: e.score, accuracy: e.accuracy, level: e.level });
          break;
        case 'resume':
          setPaused(null);
          stepRevive({ type: 'resumed' });
          break;
        case 'offset':
          // The wide probe settled (tutorial, or a run before the offset was learned): saved now, before any result.
          updateSettings({ audioOffsetMs: e.offsetMs, offsetLearned: true });
          break;
        case 'finish':
          if (e.autoOffsetMs !== null) updateSettings({ audioOffsetMs: e.autoOffsetMs });
          if (tutorial) break; // the tutorial page decides what happens next
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
          autoOffset: true,
          // The latency is learned from the first taps: in the tutorial's single-lane steps, and in runs until it has settled once. A calibration is the player's own word.
          offsetProbe: settings.calibrated ? undefined : tutorial ? 'single-lane' : settings.offsetLearned ? undefined : 'all-lanes',
          noFail: noFailFlag || tutorial,
          autoplay: autoFlag && !tutorial,
          hideHearts: tutorial,
          gems: !tutorial,
          levels: !tutorial,
          endless: !tutorial,
          // The second chance: free with NEON PASS (no ad), otherwise for a rewarded ad; neither PASS nor an ad provider (the web build) — not offered.
          revive: !tutorial && !noFailFlag,
          canRevive: () => reviveAvailable(isPassActive(), ads.available()),
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
      // The second chance's ad is playing: no restart under it (the song would play over the provider's player).
      if (reviveKeysLocked(reviveRef.current.phase)) return;
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
  }, [chart, source, audioBuffer, mode, tutorial, attempt, stepRevive]);

  const exit = useCallback(() => (hostRef.current.onExit ? hostRef.current.onExit() : navigate('menu')), []);

  const toggleSound = () => {
    sfxUi();
    const next = !muted;
    setMuted(next);
    audioEngine.setVolumes({ music: next ? 0 : getSettings().musicVolume });
  };

  // --- second chance: the 5 s offer; NEON PASS gives the hearts at once, otherwise a rewarded ad plays first ---
  const acceptRevive = () => {
    const s = sessionRef.current;
    if (!s || !s.isHeartsOut || reviveRef.current.phase !== 'offer') return;
    // A tap while the button is still rising is the finger that was hitting the lanes: no ad starts, no hearts.
    if (!reviveArmed(offerAtRef.current, performance.now())) return;
    sfxUi();
    stepRevive({ type: 'accept' });
  };
  const declineRevive = () => {
    const phase = reviveRef.current.phase;
    if (phase === 'ad') {
      // «К результату» over the stub's ad closes it: the ad ends 'closed' and nothing is given. A real network closes its own player.
      if (isStubAds) stubAds.cancel();
      return;
    }
    // «К результату» rises with the frame too: a lane tap as the last heart goes must not throw the second chance away unseen.
    if (phase === 'offer' && !reviveArmed(offerAtRef.current, performance.now())) return;
    stepRevive({ type: 'decline' });
  };
  // The offer's 5 s run only while it is on screen: the ad phase clears the timer, and a late tick is ignored there.
  useEffect(() => {
    if (revive.phase !== 'offer') return;
    const t = window.setTimeout(() => stepRevive({ type: 'timeout' }), REVIVE_OFFER_SEC * 1000);
    return () => window.clearTimeout(t);
  }, [revive.phase, stepRevive]);
  // The ad plays while the phase is 'ad'. The run stays frozen and the music paused (nothing here resumes
  // them): the song goes on only after the refill's count-in.
  useEffect(() => {
    if (revive.phase !== 'ad') return;
    let live = true;
    void watchReviveAd(ads).then((action) => {
      if (live) stepRevive(action);
    });
    return () => {
      live = false;
      // Restarted or left mid-ad: the stub stops too — its late end speaks for no run.
      if (isStubAds) stubAds.cancel();
    };
  }, [revive.phase, stepRevive]);

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

      {revive.phase !== 'idle' && <ReviveFrame phase={revive.phase} pass={revive.pass} tint={tint} onAccept={acceptRevive} onDecline={declineRevive} />}
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
  phase: 'offer' | 'ad' | 'refill';
  /** NEON PASS when the offer opened: free, no ad. */
  pass: boolean;
  /** The playing track's accent for the primary button. */
  tint?: string;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * The second-chance offer (frame 20): five empty hearts in a panel with «+5 сердец · с этого же
 * места», «СЕРДЦА КОНЧИЛИСЬ», the primary button with a 5 s ring — «СМОТРЕТЬ / рекламу · +5 сердец»,
 * or «ПРОДОЛЖИТЬ / бесплатно с PASS» — and «К результату». It only opens with NEON PASS or an ad
 * to show. The primary button is not focused (Space is the circle key); both buttons take a tap only
 * once they have risen (`REVIVE_ARM_MS`). While the ad plays the button waits, locked, with the stub's seconds in
 * its ring (a real network covers the frame with its own player), and «К результату» closes the stub
 * without a reward. Once the hearts are granted (frame 21) they pop back with sparks and the canvas
 * counts «3 / 2 / 1» under a light veil.
 */
function ReviveFrame({ phase, pass, tint, onAccept, onDecline }: ReviveProps) {
  const [left, setLeft] = useState(REVIVE_OFFER_SEC);
  // The development / `?ads=fast` build: the stub's seconds in the waiting button. A real network shows its own player.
  const ad = useStubAdProgress(stubAds, phase === 'ad' && isStubAds);
  useEffect(() => {
    if (phase !== 'offer') return;
    setLeft(REVIVE_OFFER_SEC);
    const started = performance.now();
    const t = window.setInterval(() => setLeft(Math.max(0, REVIVE_OFFER_SEC - Math.floor((performance.now() - started) / 1000))), 200);
    return () => window.clearInterval(t);
  }, [phase]);
  const refill = phase === 'refill';
  const button = reviveButton(phase === 'ad' ? 'ad' : 'offer', pass);
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
              <ObjButton icon={<Icon name="arrow" />} label={dict.toResult} onClick={onDecline} disabled={phase === 'ad' && !isStubAds} />
            </Trio>
            <PrimaryAction
              tone={button.locked ? 'locked' : 'cyan'}
              lead={
                <Disc>
                  <Icon name={button.icon} />
                </Disc>
              }
              label={button.label}
              tint={tint}
              sub={button.sub}
              beat
              disabled={button.locked}
              icon={
                phase === 'ad' ? (
                  isStubAds ? (
                    <RingCountdown size={40} seconds={1} progress={ad.progress} className="game-ring game-ring-dim" track>
                      {ad.left}
                    </RingCountdown>
                  ) : null
                ) : (
                  <RingCountdown size={40} seconds={REVIVE_OFFER_SEC} className="game-ring" track>
                    {left}
                  </RingCountdown>
                )
              }
              onClick={onAccept}
            />
          </ActionZone>
        )}
      </div>
    </div>
  );
}
