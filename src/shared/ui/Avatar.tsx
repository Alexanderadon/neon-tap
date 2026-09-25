import type { ReactNode } from 'react';
import { initialLetter } from '@/shared/lib/format';
import './avatar.css';

export type AvatarSize = 32 | 48 | 56 | 96;

interface Props {
  /** The player's name; the first letter is shown, «?» while there is none. */
  name: string;
  /** 32 = top bar, rows; 48 = player card, dialogs; 56 = the picker's cells; 96 = a hero (spec size, no screen uses it now). */
  size?: AvatarSize;
  /** `me` = the cyan sphere (the player); `other` = the dark chip face with a light letter (someone else). */
  tone?: 'me' | 'other';
  /**
   * A chosen picture instead of the letter (an `<img>` or an SVG that fills the circle): the sphere
   * becomes its frame — dark face, black underside. Callers build it (`entities/avatar`); `shared` only frames it.
   */
  art?: ReactNode;
  /** The cyan ring of the chosen cell in a picker. */
  selected?: boolean;
  className?: string;
}

/** The avatar: a glossy sphere with the first letter of the name (spec §2.1); an empty name shows the dark face with «?». */
export function Avatar({ name, size = 32, tone = 'me', art, selected = false, className }: Props) {
  const letter = initialLetter(name);
  const empty = letter === '?';
  const cls = [
    'ava',
    size !== 32 && `ava-${size}`,
    art ? 'ava-art' : tone === 'other' ? 'ava-other' : empty && 'ava-empty',
    selected && 'ava-selected',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls} aria-hidden="true">
      {art ?? letter}
    </span>
  );
}
