import { useState, type FormEvent, type ReactNode } from 'react';
import { dict } from '@/shared/i18n';
import { Avatar, Disc, Icon, Line, PrimaryAction, TextField } from '@/shared/ui';
import { NICKNAME_MAX, isValidNickname, sanitizeNickname, updateSettings } from '@/entities/settings';
import './nickname.css';

interface Props {
  /** Called after the name is saved. */
  onSaved: () => void;
  /** Secondary action under Save («Не сейчас»). */
  secondary?: ReactNode;
  /** Focus the field on mount (phones show the keyboard). */
  autoFocus?: boolean;
  /** The grey line under the field. */
  hint?: string;
  /** The 48 px avatar above the field: the first letter typed, «?» while empty. */
  avatar?: boolean;
  /** Heading between the avatar and the field («Как тебя записать?»). */
  title?: ReactNode;
  /** Id for the heading (dialogs label themselves by it). */
  titleId?: string;
}

/**
 * The nickname field + Save, shared by the welcome screen and the result-screen dialog: a 48 px
 * text field in the dark object material (cyan rim when focused), the hint, the 64 px primary
 * «СОХРАНИТЬ» (dark and still while the field is empty, cyan and breathing once a name is in).
 */
export function NicknameForm({ onSaved, secondary, autoFocus = true, hint = dict.nicknameHint, avatar = false, title, titleId }: Props) {
  const [value, setValue] = useState('');
  const clean = sanitizeNickname(value);
  const valid = isValidNickname(clean);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    updateSettings({ nickname: clean });
    onSaved();
  };

  return (
    <form className="nickname" onSubmit={submit}>
      {avatar && <Avatar name={clean} size={48} />}
      {title !== undefined && (
        <h2 className="nick-title" id={titleId}>
          {title}
        </h2>
      )}
      <TextField
        className="nick-field"
        value={value}
        maxLength={NICKNAME_MAX}
        placeholder={dict.nicknamePlaceholder}
        autoComplete="nickname"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus={autoFocus}
        aria-label={dict.nicknamePlaceholder}
        onChange={(e) => setValue(e.target.value)}
      />
      <Line className="nick-hint">{hint}</Line>
      <div className="nick-actions">
        <PrimaryAction
          type="submit"
          disabled={!valid}
          tone={valid ? 'cyan' : 'locked'}
          beat={valid}
          lead={
            <Disc>
              <Icon name="check" size={24} />
            </Disc>
          }
          label={dict.nicknameSave}
        />
        {secondary}
      </div>
    </form>
  );
}
