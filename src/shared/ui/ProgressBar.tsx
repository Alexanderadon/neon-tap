import type { CSSProperties, ReactNode } from 'react';
import './progress-bar.css';

interface Props {
  /** Fill after the change, 0..1. */
  value: number;
  /** Fill before the change, 0..1 — the light segment grows from `base` to `value` (the unlock bar on the result). */
  base?: number;
  /** Left text of the 16 px line above the track («до открытия Bouncer»). */
  label?: ReactNode;
  /** Right text of that line, gold («★ 22 / 25»). */
  right?: ReactNode;
  /** gold = earned progress (default), cyan = time / activity (slow-motion, analysis). */
  tone?: 'gold' | 'cyan';
  /** Legacy: an explicit fill colour (overrides `tone`). */
  color?: string;
  /** Run the grow of the light segment; `delay` in seconds. */
  animate?: boolean;
  delay?: number;
  className?: string;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** 8 px pill track with a gold face and a two-layer fill: `base` (before) + `add` (added now) (spec §2.10). */
export function ProgressBar({ value, base, label, right, tone = 'gold', color, animate = false, delay, className }: Props) {
  const after = clamp01(value);
  const before = base === undefined ? after : Math.min(clamp01(base), after);
  const cls = ['progress', `progress-${tone}`, animate && 'progress-animate', className].filter(Boolean).join(' ');
  const baseStyle: CSSProperties = { width: `${(before * 100).toFixed(2)}%` };
  if (color) baseStyle.background = color;
  const addStyle = {
    '--pb-base': `${(before * 100).toFixed(2)}%`,
    '--pb-from': `${((1 - before) * 100).toFixed(2)}%`,
    '--pb-to': `${((1 - after) * 100).toFixed(2)}%`,
    clipPath: `inset(0 ${((1 - after) * 100).toFixed(2)}% 0 ${(before * 100).toFixed(2)}%)`,
    animationDelay: delay !== undefined ? `${delay}s` : undefined,
  } as CSSProperties;
  return (
    <div className={cls} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(after * 100)}>
      {(label !== undefined || right !== undefined) && (
        <div className="progress-row">
          <span className="progress-label">{label}</span>
          {right !== undefined && <span className="progress-right">{right}</span>}
        </div>
      )}
      <div className="progress-track">
        <i className="progress-base" style={baseStyle} />
        {after > before && <i className="progress-add" style={addStyle} />}
      </div>
    </div>
  );
}
