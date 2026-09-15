import type { CSSProperties, ReactNode } from 'react';
import './tag.css';

export type TagVariant = 'gold' | 'dark' | 'bad' | 'mag';
export type TagShape = 'pill' | 'flush' | 'left' | 'right';

interface Props {
  /** gold = earned / label («ГЛАВА 1», «ТРЕК ДНЯ»), dark = neutral («БЫЛО 98 200»), bad = magenta danger («ПОБИЛ»), mag = dark with magenta text (errors). */
  variant?: TagVariant;
  /** pill = full pill; flush = glued to a card's left edge; left / right = the two halves of a pair («НОВЫЙ РЕКОРД | БЫЛО …»). */
  shape?: TagShape;
  /** 16 px icon before the text. */
  icon?: ReactNode;
  /** One highlight sweep across the face (new record, just bought). */
  shine?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
  children: ReactNode;
}

/** The one label: a 24 px pill, 11/700 caps, gold face with a dark-orange underside (spec §2.3). */
export function Tag({ variant = 'gold', shape = 'pill', icon, shine = false, className, style, title, children }: Props) {
  const cls = ['tag', variant !== 'gold' && `tag-${variant}`, shape !== 'pill' && `tag-${shape}`, className].filter(Boolean).join(' ');
  return (
    <span className={cls} style={style} title={title}>
      {icon && <span className="tag-icon">{icon}</span>}
      <span className="tag-text">{children}</span>
      {shine && <i className="tag-shine" aria-hidden="true" />}
    </span>
  );
}
