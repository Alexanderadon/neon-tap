import { useState } from 'react';
import { dict } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { audioEngine, preloadSfx, sfxHit, sfxMiss } from '@/shared/lib/audio';
import { Button, Slider } from '@/shared/ui';
import { FX_MODES, NICKNAME_MAX, sanitizeNickname, updateSettings, useSettings, type VoiceSetting } from '@/entities/settings';
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

      <div className="settings-group">
        <div className="settings-group-label">{dict.settingsFxMode}</div>
        <div className="settings-segmented" role="radiogroup">
          {FX_MODES.map((id) => (
            <button key={id} role="radio" aria-checked={s.fxMode === id} className={`seg ${s.fxMode === id ? 'seg-on' : ''}`} onClick={() => updateSettings({ fxMode: id })}>
              {dict.fxModes[id]}
            </button>
          ))}
        </div>
        <div className="settings-hint">{dict.settingsFxModeHint}</div>
      </div>

      <label className="settings-check">
        <input type="checkbox" checked={s.debugOverlay} onChange={(e) => updateSettings({ debugOverlay: e.target.checked })} />
        <span>{dict.fps} / debug overlay</span>
      </label>

      <NicknameField value={s.nickname} />

      <TutorialRow done={s.tutorialDone} />

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

/** Tutorial state ("passed" badge with a check mark, or "not yet") and a button to replay it. */
function TutorialRow({ done }: { done: boolean }) {
  return (
    <div className="settings-group">
      <span className="settings-group-label">{dict.tutorial}</span>
      <div className="settings-row settings-tutorial">
        <span className={`settings-badge ${done ? 'settings-badge-on' : ''}`}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className="settings-badge-icon">
            {done ? <path d="M3 8.5 L6.5 12 L13 4.5" /> : <circle cx="8" cy="8" r="5" />}
          </svg>
          {done ? dict.tutorialPassed : dict.tutorialNotPassed}
        </span>
        <Button variant="ghost" onClick={() => navigate('tutorial')}>
          {dict.tutorialReplay}
        </Button>
      </div>
    </div>
  );
}

/** Nickname for the online table: edited as a draft, sanitised and stored on blur / Enter. */
function NicknameField({ value }: { value: string }) {
  const [draft, setDraft] = useState(value);
  const commit = () => {
    const clean = sanitizeNickname(draft);
    setDraft(clean);
    if (clean !== value) updateSettings({ nickname: clean });
  };
  return (
    <label className="settings-group">
      <span className="settings-group-label">{dict.settingsNickname}</span>
      <input
        className="text-input"
        type="text"
        value={draft}
        maxLength={NICKNAME_MAX}
        placeholder={dict.nicknamePlaceholder}
        autoComplete="nickname"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
