import { useEffect, useId, useRef } from 'react';
import { dict } from '@/shared/i18n';
import { sfxUi } from '@/shared/lib/audio';
import { Avatar, Disc, Icon, ObjButton, PrimaryAction, useSwipeBack } from '@/shared/ui';
import { AVATARS, AvatarArt, avatarName } from '@/entities/avatar';
import { updateSettings, useSettings } from '@/entities/settings';
import './avatar-picker.css';

interface Props {
  open: boolean;
  /** «Готово», the veil, Escape and a back swipe — one and the same. */
  onClose: () => void;
}

/**
 * The avatar picker over a dimmed screen (the same dialog rule as the nickname question): a 335 px
 * panel with «Выбери аватар», a 4 × 3 grid of 56 px spheres with their names under them, the chosen
 * one ringed cyan. A tap chooses at once (the top bar behind the veil follows), «ГОТОВО» closes;
 * «Буква» goes back to the letter of the nickname.
 */
export function AvatarPicker({ open, onClose }: Props) {
  const titleId = useId();
  const nickname = useSettings((s) => s.nickname);
  const chosen = useSettings((s) => s.avatar);
  const opener = useRef<Element | null>(null);
  useSwipeBack(onClose, open);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const choose = (id: string) => {
    if (id === chosen) return;
    sfxUi();
    updateSettings({ avatar: id });
  };
  const done = () => {
    sfxUi();
    onClose();
  };

  return (
    <div className="avp-dim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="avp-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 className="avp-title" id={titleId}>
          {dict.avatarPickTitle}
        </h2>
        <div className="avp-grid" role="radiogroup" aria-labelledby={titleId}>
          {AVATARS.map((a) => {
            const on = a.id === chosen;
            return (
              <button key={a.id} type="button" className={on ? 'avp-cell avp-on' : 'avp-cell'} role="radio" aria-checked={on} onClick={() => choose(a.id)}>
                <Avatar name={nickname} size={56} art={<AvatarArt id={a.id} />} selected={on} />
                <span className="avp-name">{avatarName(a.id)}</span>
              </button>
            );
          })}
        </div>
        <div className="avp-actions">
          <PrimaryAction
            lead={
              <Disc>
                <Icon name="check" size={24} />
              </Disc>
            }
            label={dict.done}
            onClick={done}
          />
          <ObjButton icon={<Icon name="user" />} label={dict.avatarLetter} onClick={() => choose('')} />
        </div>
      </div>
    </div>
  );
}
