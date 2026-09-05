import type { ReactNode } from 'react';
import './ui.css';

interface Props {
  children: ReactNode;
  className?: string;
  /** Centre content vertically (menus) vs. top-aligned scrolling lists. */
  center?: boolean;
}

/**
 * Full-viewport page wrapper. The router remounts pages with a fresh key on every route change,
 * so the enter animation (`screen-enter`, 250 ms fade/rise + the glitch) replays per screen.
 */
export function Screen({ children, className = '', center = false }: Props) {
  return <div className={`screen screen-enter ${center ? 'screen-center' : ''} ${className}`}>{children}</div>;
}
