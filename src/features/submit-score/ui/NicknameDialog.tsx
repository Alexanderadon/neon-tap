import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { dict } from '@/shared/i18n';
import { Icon, ObjButton, useSwipeBack } from '@/shared/ui';
import { NicknameForm } from './NicknameForm';
import './nickname.css';

interface Props {
  open: boolean;
  /** "Not now" — remembered for the session. */
  onSkip: () => void;
}

/**
 * The nickname question over a dimmed screen (the result, a challenge): a 335 px panel in the
 * upper half (the keyboard never covers it) with the avatar, «Как тебя записать?», the field,
 * «СОХРАНИТЬ» and «Не сейчас». The veil, Escape, a back swipe and «Не сейчас» are one and the same.
 */
export function NicknameDialog({ open, onSkip }: Props) {
  const titleId = useId();
  const opener = useRef<Element | null>(null);
  useSwipeBack(onSkip, open);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onSkip();
    };
    // Capture phase so page-level hotkeys (R / Esc on the result screen) do not fire underneath.
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [open, onSkip]);

  if (!open) return null;
  // Keys typed in the field must not reach `window` hotkeys (e.g. "R" = retry on the result screen).
  const stop = (e: KeyboardEvent) => e.stopPropagation();
  return (
    <div className="nick-dim" onPointerDown={(e) => e.target === e.currentTarget && onSkip()}>
      <div className="nick-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={stop}>
        <NicknameForm
          avatar
          title={dict.nicknameTitle}
          titleId={titleId}
          hint={dict.nicknameShort}
          onSaved={onSkip}
          secondary={<ObjButton icon={<Icon name="cross" />} label={dict.nicknameSkip} onClick={onSkip} />}
        />
      </div>
    </div>
  );
}
