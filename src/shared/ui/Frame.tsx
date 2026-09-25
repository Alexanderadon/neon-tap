import type { CSSProperties, ReactNode } from 'react';
import './frame.css';

interface FrameProps {
  className?: string;
  children: ReactNode;
}

/**
 * The screen frame of every non-game screen (spec §1.4): fixed, one 335 column in 20 px gutters,
 * the top bar at safe-top + 8, the action zone at safe-bottom + 24; scrolls on short viewports.
 */
export function Frame({ className, children }: FrameProps) {
  return <div className={['frame', className].filter(Boolean).join(' ')}>{children}</div>;
}

interface SubProps {
  /** Gold tag on the left («ЗАДЕРЖКА», «НАСТРОЙКИ»). */
  tag?: ReactNode;
  /** Grey 13 px line after the tag (ellipsis); `right` pushes it to the right edge. */
  text?: ReactNode;
  right?: boolean;
  /** One centred line instead («Metal Song · Глава 1»). */
  center?: boolean;
  className?: string;
  children?: ReactNode;
}

/** Sub-header 335 × 24 under the top bar: tag + line, tag + segments (children), or one centred line. */
export function SubHeader({ tag, text, right = false, center = false, className, children }: SubProps) {
  const cls = ['sub', center && 'sub-center', className].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      {tag}
      {text !== undefined && <span className={right ? 'sub-text sub-right' : 'sub-text'}>{text}</span>}
      {children}
    </div>
  );
}

interface BodyProps {
  /** Scrolls inside (lists) instead of growing the frame. */
  scroll?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** The middle of the frame: a centred column that takes the free height (hero + headline + content). */
export function FrameBody({ scroll = false, className, style, children }: BodyProps) {
  return (
    <div className={['frame-body', scroll && 'frame-body-scroll', className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  );
}

interface LineProps {
  /** w80 instead of w55 (a line that carries information, not a hint). */
  strong?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** One grey 13 px line, 16 tall, centred; `<b>` inside is white 700. */
export function Line({ strong = false, className, style, children }: LineProps) {
  return (
    <span className={['line', strong && 'line-w80', className].filter(Boolean).join(' ')} style={style}>
      {children}
    </span>
  );
}
