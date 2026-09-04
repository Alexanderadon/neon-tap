import { useCallback, useEffect, useState } from 'react';
import { dict } from '@/shared/i18n';
import { audioEngine, preloadSfx, sfxUi, unlockAudio, useAudioUnlocked } from '@/shared/lib/audio';
import { getSettings } from '@/entities/settings';
import { voice } from '@/features/voice-feedback';
import './audio-gate.css';

/**
 * Full-screen "tap to enable sound" gate. Mobile browsers only start audio from a user gesture,
 * so the very first tap goes here: it unlocks the AudioContext, applies volumes and pre-decodes
 * SFX + voice. Reappears automatically if the context gets suspended (phone call, tab in
 * background on iOS) so sound never silently stays off.
 */
export function AudioGate() {
  const unlocked = useAudioUnlocked();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const unlock = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await unlockAudio();
      if (ok) {
        const s = getSettings();
        audioEngine.setVolumes({ music: s.musicVolume, sfx: s.sfxVolume, voice: s.voiceVolume });
        voice.setVoice(s.voice);
        void preloadSfx().then(() => sfxUi());
        void voice.preload();
      }
      setFailed(!ok);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  // Desktop convenience: any key also unlocks.
  useEffect(() => {
    if (unlocked) return;
    const onKey = () => void unlock();
    window.addEventListener('keydown', onKey, { once: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [unlocked, unlock]);

  if (unlocked) return null;
  return (
    <div className="audio-gate" role="dialog" aria-modal="true" onClick={() => void unlock()}>
      <div className="audio-gate-card">
        <div className="audio-gate-icon">{busy ? '…' : '🔊'}</div>
        <div className="audio-gate-title">{dict.audioGateTitle}</div>
        <div className="audio-gate-hint">{failed ? dict.audioGateFailed : dict.audioGateHint}</div>
        <div className="audio-gate-ios">{dict.audioGateIos}</div>
      </div>
    </div>
  );
}
