import { useCallback, useEffect, useState } from 'react';
import { dict } from '@/shared/i18n';
import { audioEngine, preloadSfx, sfxUi, unlockAudio, useAudioUnlocked } from '@/shared/lib/audio';
import { isIos } from '@/shared/lib/pwa';
import { BigDisc, Headline, Icon, Line, Tag } from '@/shared/ui';
import { getSettings } from '@/entities/settings';
import { CoverScene, TRACK_IDS, findTrack } from '@/entities/track';
import { dailyTrackId, localDateString } from '@/entities/progress';
import { voice } from '@/features/voice-feedback';
import './audio-gate.css';

/**
 * Full-screen "tap to enable sound" gate (screens-onboard C1). Mobile browsers only start audio
 * from a user gesture, so the very first tap goes here: it unlocks the AudioContext, applies
 * volumes and pre-decodes SFX + voice. Reappears automatically if the context gets suspended
 * (phone call, tab in background on iOS) so sound never silently stays off. The whole screen is
 * the button: a breathing 96 px disc, two words, and — only after a failed attempt — a short
 * dark tag naming the volume (or the iPhone mute switch).
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
  const daily = dailyTrackId(localDateString(), TRACK_IDS) ?? undefined;
  return (
    <div className="gate" role="dialog" aria-modal="true" aria-label={dict.audioGateTitle} onClick={() => void unlock()}>
      <CoverScene id={daily} genre={daily ? findTrack(daily)?.genre : undefined} />
      <header className="gate-top">{dict.appTitle}</header>
      <div className="gate-body">
        <BigDisc className={busy ? 'gate-disc is-busy' : 'gate-disc'} beat={!busy} onClick={() => void unlock()} aria-label={dict.audioGateTitle}>
          <Icon name="sound" />
        </BigDisc>
        <Headline className="gate-head">{dict.audioGateTitle}</Headline>
        <Line className="gate-line">{failed ? dict.tapAgain : dict.tapAnywhere}</Line>
        {failed && (
          <div className="gate-tag">
            <Tag variant="dark" className="gate-tag-white">
              {ios ? dict.audioGateMuteShort : dict.audioGateVolumeShort}
            </Tag>
          </div>
        )}
      </div>
    </div>
  );
}
