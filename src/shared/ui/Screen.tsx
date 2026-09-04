import type { ReactNode } from 'react';
import './ui.css';

interface Props {
  children: ReactNode;
  className?: string;
  /** Centre content vertically (menus) vs. top-aligned scrolling lists. */
  center?: boolean;
}

/** Full-viewport page wrapper with the glitch enter transition. */
export function Screen({ children, className = '', center = false }: Props) {
  return <div className={`screen glitch-in ${center ? 'screen-center' : ''} ${className}`}>{children}</div>;
}
