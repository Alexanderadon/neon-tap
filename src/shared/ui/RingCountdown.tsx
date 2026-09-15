import type { CSSProperties, ReactNode } from 'react';
import './ring-countdown.css';

interface Props {
  /** Outer size, px (the shop preview disc is 40, the ad countdown 96). */
  size?: number;
  /** Full drain time, seconds — drives the CSS animation when `progress` is not given. */
  seconds: number;
  /** Controlled progress 0..1 (0 = full ring, 1 = drained). Omit to let CSS drain it over `seconds`. */
  progress?: number;
  stroke?: number;
  /** Ring colour (cyan by default). */
  color?: string;
  /** Faint full-circle track behind the ring. */
  track?: boolean;
  /** Content in the centre (an icon, the seconds left). */
  children?: ReactNode;
  className?: string;
}

/** Circular countdown: one SVG circle whose stroke-dashoffset runs from 0 to the circumference (spec: shop preview ring, ad timer). */
export function RingCountdown({ size = 40, seconds, progress, stroke = 2, color, track = true, children, className }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const controlled = progress !== undefined;
  const offset = controlled ? c * Math.max(0, Math.min(1, progress)) : 0;
  const style = {
    width: size,
    height: size,
    '--ring-c': `${c.toFixed(2)}px`,
    '--ring-seconds': `${seconds}s`,
    color,
  } as CSSProperties;
  const cls = ['ring', !controlled && 'ring-run', className].filter(Boolean).join(' ');
  return (
    <span className={cls} style={style}>
      <svg className="ring-svg" viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        {track && <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />}
        <circle
          className="ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c.toFixed(2)}
          strokeDashoffset={offset.toFixed(2)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children !== undefined && <span className="ring-center">{children}</span>}
    </span>
  );
}
