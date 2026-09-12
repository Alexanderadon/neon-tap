import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { dict } from '@/shared/i18n';
import { Button } from '@/shared/ui';
import { NICKNAME_MAX, sanitizeNickname, updateSettings } from '@/entities/settings';
import { isValidNickname } from '../model/submitScore';
import './nickname.css';

interface Props {
  /** Called after the name is saved. */
  onSaved: () => void;
  /** Optional secondary action rendered next to Save (e.g. "not now"). */
  secondary?: ReactNode;
  /** Focus the field on mount (phones show the keyboard). */
  autoFocus?: boolean;
  hint?: string;
}

/** The nickname field + Save: shared by the welcome screen and the result-screen dialog. */
export function NicknameForm({ onSaved, secondary, autoFocus = true, hint = dict.nicknameHint }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
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
      <input
        ref={inputRef}
        className="text-input"
        type="text"
        value={value}
        maxLength={NICKNAME_MAX}
        placeholder={dict.nicknamePlaceholder}
        autoComplete="nickname"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="nickname-hint">{hint}</div>
      <div className="nickname-actions">
        <Button type="submit" disabled={!valid}>
          {dict.nicknameSave}
        </Button>
        {secondary}
      </div>
    </form>
  );
}
