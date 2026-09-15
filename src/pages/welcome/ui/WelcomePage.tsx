import { useState, type FormEvent } from 'react';
import { dict, fmt } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { sfxUi } from '@/shared/lib/audio';
import {
  ActionZone,
  Avatar,
  Disc,
  Frame,
  FrameBody,
  Headline,
  Icon,
  Line,
  ObjButton,
  PrimaryAction,
  Segments,
  SubHeader,
  Tag,
  TextField,
  Trio,
  segmentStates,
} from '@/shared/ui';
import { NICKNAME_MAX, isValidNickname, markWelcomeSkipped, sanitizeNickname, updateSettings, useSettings } from '@/entities/settings';
import { avatarArtOf } from '@/entities/avatar';
import { AvatarPicker } from '@/features/choose-avatar';
import { CoverScene, TRACK_IDS, findTrack } from '@/entities/track';
import { dailyTrackId, localDateString } from '@/entities/progress';
import { TopBar } from '@/widgets/top-bar';
import './welcome.css';

/** First-launch steps: name · calibration · tutorial. */
const STEP = 1;
const STEPS = 3;

/**
 * First launch, step 1 of 3 (screens-onboard C2): «NEON TAP» in the top row, the step tag with three
 * segments, a 96 px avatar showing the first letter as it is typed (a tap on it opens the avatar
 * picker — «выбери аватар» under it), «КАК ТЕБЯ ЗОВУТ?», one field
 * above the middle of the screen (the keyboard covers only the action zone), «Не сейчас» and
 * «ДАЛЬШЕ / калибровка» — locked until there is a name. Enter / «Готово» on the keyboard saves.
 */
export function WelcomePage() {
  const [value, setValue] = useState('');
  const [pick, setPick] = useState(false);
  const avatar = useSettings((s) => s.avatar);
  const clean = sanitizeNickname(value);
  const valid = isValidNickname(clean);
  const daily = dailyTrackId(localDateString(), TRACK_IDS) ?? undefined;

  const next = () => navigate('menu');
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!valid) return;
    sfxUi();
    updateSettings({ nickname: clean });
    next();
  };
  const openPicker = () => {
    sfxUi();
    setPick(true);
  };
  const skip = () => {
    sfxUi();
    markWelcomeSkipped();
    next();
  };

  return (
    <Frame as="form" className="welcome" onSubmit={submit}>
      <CoverScene id={daily} genre={daily ? findTrack(daily)?.genre : undefined} />
      <TopBar variant="title" />
      <SubHeader tag={<Tag>{fmt(dict.stepOf, { n: STEP, m: STEPS })}</Tag>}>
        <Segments states={segmentStates(STEPS, STEP - 1)} />
      </SubHeader>
      <FrameBody>
        <button type="button" className="welcome-ava" aria-label={dict.avatarPickAria} onClick={openPicker}>
          <Avatar name={clean} size={96} art={avatarArtOf(avatar)} />
          <span className="welcome-ava-hint">{dict.welcomeAvatarHint}</span>
        </button>
        <Headline className="welcome-head">{dict.welcomeTitle}</Headline>
        <TextField
          className="welcome-field"
          value={value}
          maxLength={NICKNAME_MAX}
          placeholder={dict.nicknamePlaceholder}
          autoComplete="nickname"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
          enterKeyHint="done"
          aria-label={dict.welcomeTitle}
          onChange={(e) => setValue(e.target.value)}
        />
        <Line className="welcome-hint">{dict.welcomeHintShort}</Line>
      </FrameBody>
      <ActionZone className="welcome-actions">
        <Trio one>
          <ObjButton type="button" icon={<Icon name="skip" />} label={dict.nicknameSkip} onClick={skip} />
        </Trio>
        <PrimaryAction
          type="submit"
          tone={valid ? 'cyan' : 'locked'}
          beat={valid}
          disabled={!valid}
          lead={
            <Disc>
              <Icon name="arrow" />
            </Disc>
          }
          label={dict.next}
          sub={dict.welcomeNext}
        />
      </ActionZone>
      <AvatarPicker open={pick} onClose={() => setPick(false)} />
    </Frame>
  );
}
