import { OFFSET_RANGE_MS, SCROLL_SPEED_RANGE } from '@/shared/config/constants';
import { dict } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { audioEngine, preloadSfx, sfxHit, sfxMiss } from '@/shared/lib/audio';
import { Button, Slider } from '@/shared/ui';
import { updateSettings, useSettings, type VoiceSetting } from '@/entities/settings';
import { resetProgress } from '@/entities/progress';
import { voice } from '@/features/voice-feedback';
import './settings.css';

const VOICE_OPTIONS: VoiceSetting[] = ['dmitry', 'svetlana', 'off'];

export function SettingsPanel() {
  const s = useSettings((x) => x);

  const setVolume = (key: 'musicVolume' | 'sfxVolume' | 'voiceVolume', v: number) => {
    updateSettings({ [key]: v });
    audioEngine.setVolumes({ music: key === 'musicVolume' ? v : s.musicVolume, sfx: key === 'sfxVolume' ? v : s.sfxVolume, voice: key === 'voiceVolume' ? v : s.voiceVolume });
  };

  const chooseVoice = async (id: VoiceSetting) => {
    updateSettings({ voice: id });
    await audioEngine.ensureContext();
    voice.setVoice(id);
    if (id !== 'off') {
      await voice.preload();
      voice.say('poehali', true);
    }
  };

  const previewSfx = async () => {
    await audioEngine.ensureContext();
    await preloadSfx();
    sfxHit(0);
    setTimeout(() => sfxHit(1), 180);
    setTimeout(() => sfxHit(0), 360);
    setTimeout(() => sfxMiss(), 700);
  };

  return (
    <div className="settings">
      <Slider
        label={dict.settingsOffset}
        value={s.audioOffsetMs}
        min={OFFSET_RANGE_MS.min}
        max={OFFSET_RANGE_MS.max}
        step={1}
        format={(v) => `${v > 0 ? '+' : ''}${v} ${dict.ms}`}
        hint={dict.settingsOffsetHint}
        onChange={(v) => updateSettings({ audioOffsetMs: v })}
      />
      <Slider
        label={dict.settingsScroll}
        value={s.scrollSpeed}
        min={SCROLL_SPEED_RANGE.min}
        max={SCROLL_SPEED_RANGE.max}
        step={SCROLL_SPEED_RANGE.step}
        format={(v) => `${v.toFixed(1)}×`}
        onChange={(v) => updateSettings({ scrollSpeed: v })}
      />
      <Slider label={dict.settingsVolumeMusic} value={s.musicVolume} min={0} max={1} step={0.05} format={pct} onChange={(v) => setVolume('musicVolume', v)} />
      <div className="settings-row">
        <Slider label={dict.settingsVolumeSfx} value={s.sfxVolume} min={0} max={1} step={0.05} format={pct} onChange={(v) => setVolume('sfxVolume', v)} />
        <Button variant="ghost" onClick={previewSfx}>
          {dict.settingsPreview}
        </Button>
      </div>
      <Slider label={dict.settingsVolumeVoice} value={s.voiceVolume} min={0} max={1} step={0.05} format={pct} onChange={(v) => setVolume('voiceVolume', v)} />

      <div className="settings-group">
        <div className="settings-group-label">{dict.settingsVoice}</div>
        <div className="settings-segmented" role="radiogroup">
          {VOICE_OPTIONS.map((id) => (
            <button key={id} role="radio" aria-checked={s.voice === id} className={`seg ${s.voice === id ? 'seg-on' : ''}`} onClick={() => chooseVoice(id)}>
              {dict.voices[id]}
            </button>
          ))}
        </div>
        <div className="settings-hint">{dict.settingsVoiceHint}</div>
      </div>

      <label className="settings-check">
        <input type="checkbox" checked={s.touchAssist} onChange={(e) => updateSettings({ touchAssist: e.target.checked })} />
        <span>
          {dict.settingsTouchAssist}
          <span className="settings-hint"> · {dict.settingsTouchAssistHint}</span>
        </span>
      </label>

      <label className="settings-check">
        <input type="checkbox" checked={s.debugOverlay} onChange={(e) => updateSettings({ debugOverlay: e.target.checked })} />
        <span>{dict.fps} / debug overlay</span>
      </label>

      <div className="settings-actions">
        <Button variant="ghost" onClick={() => navigate('calibration')}>
          {dict.settingsRecalibrate}
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            if (confirm(dict.settingsResetConfirm)) resetProgress();
          }}
        >
          {dict.settingsReset}
        </Button>
      </div>
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
