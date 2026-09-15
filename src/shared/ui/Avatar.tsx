import { initialLetter } from '@/shared/lib/format';
import './avatar.css';

export type AvatarSize = 32 | 48 | 96;

interface Props {
  /** The player's name; the first letter is shown, «?» while there is none. */
  name: string;
  /** 32 = top bar, rows; 48 = player card, dialogs; 96 = the welcome hero. */
  size?: AvatarSize;
  /** `me` = the cyan sphere (the player); `other` = the dark chip face with a light letter (someone else). */
  tone?: 'me' | 'other';
  className?: string;
}

/** The avatar: a glossy sphere with the first letter of the name (spec §2.1); an empty name shows the dark face with «?». */
export function Avatar({ name, size = 32, tone = 'me', className }: Props) {
  const letter = initialLetter(name);
  const empty = letter === '?';
  const cls = ['ava', size !== 32 && `ava-${size}`, tone === 'other' ? 'ava-other' : empty && 'ava-empty', className].filter(Boolean).join(' ');
  return (
    <span className={cls} aria-hidden="true">
      {letter}
    </span>
  );
}
