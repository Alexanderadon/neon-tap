import { useEffect, useRef, useState } from 'react';
import { audioEngine, preloadSfx } from '@/shared/lib/audio';
import { navigate } from '@/shared/lib/router';
import { dict } from '@/shared/i18n';
import { Button } from '@/shared/ui';
import type { ChartFile } from '@/shared/types/chart';
import type { Difficulty } from '@/shared/config/constants';
import { getSettings } from '@/entities/settings';
import { GameSession, type SessionEvent } from '@/features/play-chart';
import { saveResult } from '@/features/save-result';
import { voice, praise } from '@/features/voice-feedback';
import type { ChartSource } from '@/entities/play-session';
import './game-canvas.css';

interface Props {
  chart: ChartFile;
  difficulty: Difficulty;
  source: ChartSource;
  /** Pre-decoded audio for custom songs. */
  audioBuffer: AudioBuffer | null;
}

const isTouchDevice = () => matchMedia('(pointer: coarse)').matches;

/** Hosts the canvas, owns the GameSession lifecycle and routes session events to voice/save. */
export function GameCanvas({ chart, difficulty, source, audioBuffer }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let session: GameSession | null = null;

    const onEvent = (e: SessionEvent) => {
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
          if (e.kind === 'slow') voice.say('ogon', true);
          break;
        case 'lanes':
          if (e.lanes >= 5) voice.say('tak-derzhat');
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
        const [buffer] = await Promise.all([
          audioBuffer ?? audioEngine.loadUrl(`${import.meta.env.BASE_URL}${chart.audio}`),
          preloadSfx(),
          voice.preload(),
        ]);
        if (cancelled || !canvasRef.current) return;
        session = new GameSession({
          chart,
          difficulty,
          audioBuffer: buffer,
          canvas: canvasRef.current,
          userOffset: settings.audioOffsetMs / 1000,
          scrollSpeed: settings.scrollSpeed,
          touch: isTouchDevice(),
          touchAssist: settings.touchAssist,
          noFail: new URLSearchParams(window.location.search).has('nofail'),
          debug: settings.debugOverlay,
          onEvent,
        });
        sessionRef.current = session;
        setStatus('ready');
        session.start();
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
      } else if (e.code === 'F3') {
        e.preventDefault();
      }
    };
    const onVisibility = () => {
      if (document.hidden) sessionRef.current?.pause();
      // Coming back: iOS may have suspended the context; the audio gate re-appears if so.
      else void audioEngine.ensureContext();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      session?.destroy();
      sessionRef.current = null;
    };
  }, [chart, difficulty, source, audioBuffer]);

  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="game-canvas" />
      {status === 'loading' && <div className="game-overlay">{dict.loading}</div>}
      {status === 'error' && (
        <div className="game-overlay">
          <p>{dict.customError}</p>
          <Button onClick={() => navigate('menu')}>{dict.toMenu}</Button>
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
          <Button variant="ghost" onClick={() => navigate('menu')}>
            {dict.exit}
          </Button>
        </div>
      )}
    </div>
  );
}
