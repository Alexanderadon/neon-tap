import type { ReactNode } from 'react';
import './ui.css';

interface Props {
  children: ReactNode;
  className?: string;
  /** Centre content vertically (menus) vs. top-aligned scrolling lists. */
  center?: boolean;
  /** The design-system frame (spec §1.4): one 335 column in 20 px gutters, safe-top + 8 above, safe-bottom + 24 below, Unbounded, nowrap. */
  frame?: boolean;
}

/**
 * Full-viewport page wrapper. The router remounts pages with a fresh key on every route change,
 * so the enter animation (`screen-enter`, 250 ms fade/rise + the glitch) replays per screen.
 */
export function Screen({ children, className, center = false, frame = false }: Props) {
  const cls = ['screen screen-enter', center && 'screen-center', frame && 'screen-frame', className].filter(Boolean).join(' ');
  return <div className={cls}>{children}</div>;
}
