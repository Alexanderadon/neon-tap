import { useState } from 'react';
import { dict } from '@/shared/i18n';
import { audioEngine, preloadSfx, sfxHit, sfxMiss } from '@/shared/lib/audio';
import { Avatar, Icon, Line, ObjButton, Panel, SliderRow, Tag, TextField, Toggle, Trio, type IconName } from '@/shared/ui';
import { FX_MODES, NICKNAME_MAX, sanitizeNickname, updateSettings, useSettings, type FxMode, type VoiceSetting } from '@/entities/settings';
import { avatarArtOf } from '@/entities/avatar';
import { voice } from '@/features/voice-feedback';
import './settings.css';

const VOICE_OPTIONS: VoiceSetting[] = ['dmitry', 'svetlana', 'off'];
const VOICE_ICON: Record<VoiceSetting, IconName> = { dmitry: 'bubble', svetlana: 'bubble', off: 'sound-off' };
const FX_ICON: Record<FxMode, IconName> = { auto: 'gauge', on: 'battery', off: 'bolt' };

/**
 * The scrolling column of settings panels (screens-onboard C6), gap 8: volumes (three SliderRows —
 * releasing «Эффекты» plays the preview), the narrator voice and the economy mode as rows of three
 * object buttons, the nickname with its avatar letter, the tutorial state, the FPS toggle.
 * Every change applies at once through `updateSettings`; the store keys are untouched.
 */
export function SettingsPanel() {
  const s = useSettings((x) => x);

  const setVolume = (key: 'musicVolume' | 'sfxVolume' | 'voiceVolume', v: number) => {
    updateSettings({ [key]: v });
    audioEngine.setVolumes({
      music: key === 'musicVolume' ? v : s.musicVolume,
      sfx: key === 'sfxVolume' ? v : s.sfxVolume,
      voice: key === 'voiceVolume' ? v : s.voiceVolume,
    });
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
      <Panel aria-label={dict.settingsVolumeMusic}>
        <SliderRow label={dict.settingsVolumeMusic} value={s.musicVolume} onChange={(v) => setVolume('musicVolume', v)} />
        <SliderRow label={dict.settingsVolumeSfx} value={s.sfxVolume} onChange={(v) => setVolume('sfxVolume', v)} onRelease={() => void previewSfx()} />
        <SliderRow label={dict.settingsVolumeVoice} value={s.voiceVolume} onChange={(v) => setVolume('voiceVolume', v)} />
      </Panel>

      <Panel label={dict.settingsVoice}>
        <Trio role="radiogroup" aria-label={dict.settingsVoice}>
          {VOICE_OPTIONS.map((id) => (
            <ObjButton
              key={id}
              role="radio"
              aria-checked={s.voice === id}
              active={s.voice === id}
              icon={<Icon name={VOICE_ICON[id]} />}
              label={dict.voices[id]}
              onClick={() => void chooseVoice(id)}
            />
          ))}
        </Trio>
        <Line>{dict.settingsVoiceHint}</Line>
      </Panel>

      <Panel label={dict.settingsFxMode}>
        <Trio role="radiogroup" aria-label={dict.settingsFxMode}>
          {FX_MODES.map((id) => (
            <ObjButton
              key={id}
              role="radio"
              aria-checked={s.fxMode === id}
              active={s.fxMode === id}
              icon={<Icon name={FX_ICON[id]} />}
              label={dict.fxModes[id]}
              onClick={() => updateSettings({ fxMode: id })}
            />
          ))}
        </Trio>
        <Line>{dict.fxModeHintShort}</Line>
      </Panel>

      <Panel label={dict.settingsNickname}>
        <NicknameRow value={s.nickname} />
      </Panel>

      <Panel>
        <div className="settings-rowl">
          <span className="settings-rowl-title">{dict.tutorial}</span>
          {s.tutorialDone ? <Tag>{dict.passed}</Tag> : <Tag variant="dark">{dict.notPassed}</Tag>}
        </div>
      </Panel>

      <Panel>
        <div className="settings-rowl">
          <span className="settings-rowl-text">
            <span className="settings-rowl-title">{dict.showFps}</span>
            <Line className="settings-line-left">{dict.forDev}</Line>
          </span>
          <Toggle checked={s.debugOverlay} onChange={(on) => updateSettings({ debugOverlay: on })} aria-label={dict.showFps} />
        </div>
      </Panel>
    </div>
  );
}

/** Nickname for the online table: the avatar (chosen picture or the letter) + field; edited as a draft, sanitised and stored on blur / Enter. */
function NicknameRow({ value }: { value: string }) {
  const [draft, setDraft] = useState(value);
  const avatar = useSettings((s) => s.avatar);
  const commit = () => {
    const clean = sanitizeNickname(draft);
    setDraft(clean);
    if (clean !== value) updateSettings({ nickname: clean });
  };
  return (
    <div className="settings-who">
      <Avatar name={draft} art={avatarArtOf(avatar)} />
      <TextField
        value={draft}
        maxLength={NICKNAME_MAX}
        placeholder={dict.nicknamePlaceholder}
        autoComplete="nickname"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="done"
        aria-label={dict.settingsNickname}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}
