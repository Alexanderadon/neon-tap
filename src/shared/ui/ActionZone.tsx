import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import './action-zone.css';

interface ZoneProps {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** The bottom action zone (spec §1.4): a 335 column — the trio row (48), gap 16, the primary button (64) — glued to the bottom. */
export function ActionZone({ className, style, children }: ZoneProps) {
  return (
    <div className={['actions', className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  );
}

interface TrioProps extends HTMLAttributes<HTMLDivElement> {
  /** One full-width cell instead of three («Не сейчас» alone). */
  one?: boolean;
}

/** The row of three object buttons: `105 + 10 + 105 + 10 + 105`, 48 tall (spec §1.4). */
export function Trio({ one = false, className, children, ...rest }: TrioProps) {
  return (
    <div className={['trio', one && 'trio-one', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}
