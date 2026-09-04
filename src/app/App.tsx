import { useEffect } from 'react';
import { navigate, useRouteKey, useScreen } from '@/shared/lib/router';
import { audioEngine, preloadSfx } from '@/shared/lib/audio';
import { getSettings } from '@/entities/settings';
import { voice } from '@/features/voice-feedback';
import { MenuPage } from '@/pages/menu';
import { GamePage } from '@/pages/game';
import { ResultPage } from '@/pages/result';
import { CalibrationPage } from '@/pages/calibration';
import { SettingsPage } from '@/pages/settings';
import { CustomSongPage } from '@/pages/custom';

/** Screen router: the game has no URLs on purpose — restart must never trigger navigation. */
export function App() {
  const screen = useScreen();
  const key = useRouteKey();

  // First launch → latency calibration (GDD §4, critical requirement 2).
  useEffect(() => {
    if (!getSettings().calibrated) navigate('calibration');
  }, []);

  // Warm up audio on the first gesture: unlock the AudioContext and decode SFX + voice clips
  // so the first button click and the first note already have real sounds.
  useEffect(() => {
    const warm = () => {
      window.removeEventListener('pointerdown', warm);
      window.removeEventListener('keydown', warm);
      void audioEngine.ensureContext().then(() => {
        const s = getSettings();
        audioEngine.setVolumes({ music: s.musicVolume, sfx: s.sfxVolume, voice: s.voiceVolume });
        voice.setVoice(s.voice);
        void preloadSfx();
        void voice.preload();
      });
    };
    window.addEventListener('pointerdown', warm, { once: true });
    window.addEventListener('keydown', warm, { once: true });
    return () => {
      window.removeEventListener('pointerdown', warm);
      window.removeEventListener('keydown', warm);
    };
  }, []);

  switch (screen) {
    case 'game':
      return <GamePage key={key} />;
    case 'result':
      return <ResultPage key={key} />;
    case 'calibration':
      return <CalibrationPage key={key} />;
    case 'settings':
      return <SettingsPage key={key} />;
    case 'custom':
      return <CustomSongPage key={key} />;
    default:
      return <MenuPage key={key} />;
  }
}
