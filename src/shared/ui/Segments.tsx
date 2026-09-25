import type { CSSProperties } from 'react';
import type { SegmentState } from './segmentStates';
import './segments.css';

interface Props {
  /** One state per segment: done = gold, current = cyan with a glow, rest = w10. */
  states: readonly SegmentState[];
  /** Makes every segment a 24 px tap target (the chapter row jumps to a track). */
  onSelect?: (index: number) => void;
  /** Accessible names of the tap targets (with `onSelect`). */
  labels?: readonly string[];
  'aria-label'?: string;
  className?: string;
}

/** Progress segments 8 px, r 999, gap 4, `flex: 1` each (chapter row, tutorial steps, goal tiers). */
export function Segments({ states, onSelect, labels, className, ...rest }: Props) {
  const cls = ['segs', className].filter(Boolean).join(' ');
  const segClass = (s: SegmentState) => (s === 'done' ? 'seg seg-done' : s === 'current' ? 'seg seg-cur' : 'seg');
  if (onSelect) {
    return (
      <ol className={cls} aria-label={rest['aria-label']}>
        {states.map((s, i) => (
          <li key={i} className={segClass(s)} aria-current={s === 'current' ? 'true' : undefined}>
            <button type="button" className="seg-hit" onClick={() => onSelect(i)} aria-label={labels?.[i]} />
          </li>
        ))}
      </ol>
    );
  }
  return (
    <span className={cls} aria-label={rest['aria-label']} aria-hidden={rest['aria-label'] === undefined ? 'true' : undefined}>
      {states.map((s, i) => (
        <i key={i} className={segClass(s)} />
      ))}
    </span>
  );
}

interface PulseProps {
  /** Number of segments: 3 in a state panel (96 px), 10 across the loading skeleton. */
  count?: number;
  /** Fixed width; `flex: 1` when omitted. */
  width?: number;
  className?: string;
}

/** Loading: the segments light up cyan one after another (state panels, the game's loading skeleton). */
export function SegmentsPulse({ count = 3, width, className }: PulseProps) {
  const cls = ['segs segs-pulse', className].filter(Boolean).join(' ');
  const style: CSSProperties | undefined = width !== undefined ? { width, flex: 'none' } : undefined;
  return (
    <span className={cls} style={style} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} className="seg" style={{ animationDelay: `${(i * 0.15).toFixed(2)}s` }} />
      ))}
    </span>
  );
}
