import { useRef, useState, type FormEvent } from 'react';
import { dict } from '@/shared/i18n';
import { Button, Modal } from '@/shared/ui';
import { NICKNAME_MAX, sanitizeNickname, updateSettings } from '@/entities/settings';
import { isValidNickname } from '../model/submitScore';
import './nickname.css';

interface Props {
  open: boolean;
  /** "Not now" — remembered for the session. */
  onSkip: () => void;
}

/** One-time nickname prompt for the online table; the name lands in settings. */
export function NicknameDialog({ open, onSkip }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const clean = sanitizeNickname(value);
  const valid = isValidNickname(clean);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    updateSettings({ nickname: clean });
  };

  return (
    <Modal
      open={open}
      title={dict.nicknameTitle}
      onClose={onSkip}
      closeLabel={dict.nicknameSkip}
      variant="dialog"
      initialFocus={inputRef}
    >
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
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="nickname-hint">{dict.nicknameHint}</div>
        <div className="nickname-actions">
          <Button type="submit" disabled={!valid}>
            {dict.nicknameSave}
          </Button>
          <Button type="button" variant="ghost" onClick={onSkip}>
            {dict.nicknameSkip}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
