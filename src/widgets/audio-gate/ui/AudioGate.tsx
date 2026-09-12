import { useCallback, useEffect, useState } from 'react';
import { dict } from '@/shared/i18n';
import { audioEngine, preloadSfx, sfxUi, unlockAudio, useAudioUnlocked } from '@/shared/lib/audio';
import { isIos } from '@/shared/lib/pwa';
import { getSettings } from '@/entities/settings';
import { voice } from '@/features/voice-feedback';
import './audio-gate.css';

/**
 * Full-screen "tap to enable sound" gate. Mobile browsers only start audio from a user gesture,
 * so the very first tap goes here: it unlocks the AudioContext, applies volumes and pre-decodes
 * SFX + voice. Reappears automatically if the context gets suspended (phone call, tab in
 * background on iOS) so sound never silently stays off. One button, two words; a single line
 * of help appears only after a failed attempt (and names the iPhone mute switch on iOS).
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
  const ios = typeof navigator !== 'undefined' && isIos(navigator.userAgent, typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  return (
    <div className="audio-gate" role="dialog" aria-modal="true" aria-label={dict.audioGateTitle} onClick={() => void unlock()}>
      <button type="button" className={`audio-gate-btn${busy ? ' is-busy' : ''}`} aria-label={dict.audioGateTitle}>
        <span className="audio-gate-ring" aria-hidden="true" />
        <SpeakerIcon />
      </button>
      <div className="audio-gate-title">{dict.audioGateTitle}</div>
      {failed && <div className="audio-gate-help">{ios ? dict.audioGateMuteSwitch : dict.audioGateVolume}</div>}
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6" />
      <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  );
}
