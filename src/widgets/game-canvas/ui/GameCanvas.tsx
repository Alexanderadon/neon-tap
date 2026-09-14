import { useEffect, useRef, useState } from 'react';
import { audioEngine, preloadSfx } from '@/shared/lib/audio';
import { navigate } from '@/shared/lib/router';
import { needsRotateHint } from '@/shared/lib/viewport';
import { dict } from '@/shared/i18n';
import { Button } from '@/shared/ui';
import type { ChartFile } from '@/shared/types/chart';
import { getSettings, updateSettings } from '@/entities/settings';
import { GameSession, type SessionEvent } from '@/features/play-chart';
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
}

const isTouchDevice = () => matchMedia('(pointer: coarse)').matches;

/** Hosts the canvas, owns the GameSession lifecycle and routes session events to voice/save. */
export function GameCanvas({ chart, source, audioBuffer, mode = 'play', onEvent, onTime, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [paused, setPaused] = useState(false);
  // Latest host callbacks without re-creating the session when the parent re-renders.
  const hostRef = useRef({ onEvent, onTime, onExit });
  hostRef.current = { onEvent, onTime, onExit };

  useEffect(() => {
    let cancelled = false;
    let session: GameSession | null = null;
    const tutorial = mode === 'tutorial';

    const handleEvent = (e: SessionEvent) => {
      hostRef.current.onEvent?.(e);
      switch (e.type) {
        case 'start':
          voice.say('poehali', true);
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
        case 'fail':
          setPaused(false);
          break;
        case 'pause':
          setPaused(true);
          break;
        case 'resume':
          setPaused(false);
          break;
        case 'finish':
          if (tutorial) break; // the tutorial page decides what happens next
          if (e.autoOffsetMs !== null) updateSettings({ audioOffsetMs: e.autoOffsetMs });
          saveResult(e.result, source);
          navigate('result');
          break;
      }
    };

    (async () => {
      try {
        await audioEngine.ensureContext();
        const settings = getSettings();
        audioEngine.setVolumes({ music: settings.musicVolume, sfx: settings.sfxVolume, voice: settings.voiceVolume });
        voice.setVoice(settings.voice);
        const [buffer] = await Promise.all([audioBuffer ?? audioEngine.loadUrl(`${import.meta.env.BASE_URL}${chart.audio}`), preloadSfx(), voice.preload()]);
        if (cancelled || !canvasRef.current) return;
        const noFailFlag = new URLSearchParams(window.location.search).has('nofail');
        session = new GameSession({
          chart,
          audioBuffer: buffer,
          canvas: canvasRef.current,
          userOffset: settings.audioOffsetMs / 1000,
          touch: isTouchDevice(),
          touchAssist: true,
          autoOffset: !tutorial,
          noFail: noFailFlag || tutorial,
          hideHearts: tutorial,
          gems: !tutorial,
          levels: !tutorial,
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
        setPaused(false);
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
  }, [chart, source, audioBuffer, mode]);

  const exit = () => (hostRef.current.onExit ? hostRef.current.onExit() : navigate('menu'));

  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="game-canvas" />
      {status === 'loading' && <div className="game-overlay">{dict.loading}</div>}
      {status === 'error' && (
        <div className="game-overlay">
          <p>{dict.customError}</p>
          <Button onClick={exit}>{dict.toMenu}</Button>
        </div>
      )}
      {status === 'ready' && (
        <div className="game-topbar">
          <button
            className="game-iconbtn"
            aria-label={dict.pause}
            onClick={() => {
              const s = sessionRef.current;
              if (!s) return;
              if (s.isPaused) s.resume();
              else s.pause();
            }}
          >
            {paused ? '▶' : '❚❚'}
          </button>
        </div>
      )}
      {paused && (
        <div className="game-pause-menu">
          <Button size="lg" onClick={() => sessionRef.current?.resume()}>
            {dict.resume}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              sessionRef.current?.restart();
              setPaused(false);
            }}
          >
            {dict.restart}
          </Button>
          <Button variant="ghost" onClick={exit}>
            {dict.exit}
          </Button>
        </div>
      )}
    </div>
  );
}
