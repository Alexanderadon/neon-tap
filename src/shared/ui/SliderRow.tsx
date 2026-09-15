import type { CSSProperties } from 'react';
import { VOLUME_STEP, percentLabel, volumePercent } from '@/shared/lib/format';
import './slider-row.css';

interface Props {
  label: string;
  /** 0..1 */
  value: number;
  onChange: (v: number) => void;
  /** Called when the finger / key lets go (the SFX row plays a preview here instead of a «Послушать» button). */
  onRelease?: () => void;
}

/**
 * SliderRow 48 (screens-onboard notes): label 15/700 in 96 px · 8 px track with a cyan fill and a 24 px
 * thumb in the primary's face · value 15/700 cyan in 56 px, right-aligned. The visible track is drawn
 * by CSS; a transparent native `<input type="range">` on top keeps dragging, keys and the screen reader.
 */
export function SliderRow({ label, value, onChange, onRelease }: Props) {
  const pct = volumePercent(value);
  const style = { '--pct': `${pct}%` } as CSSProperties;
  return (
    <label className="srow">
      <span className="srow-label">{label}</span>
      <span className="srow-bar" style={style}>
        <i className="srow-fill" aria-hidden="true" />
        <i className="srow-thumb" aria-hidden="true" />
        <input
          className="srow-input"
          type="range"
          min={0}
          max={1}
          step={VOLUME_STEP}
          value={value}
          aria-label={label}
          aria-valuetext={percentLabel(value)}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerUp={onRelease}
          onKeyUp={(e) => {
            if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' || e.key.startsWith('Page')) onRelease?.();
          }}
        />
      </span>
      <span className="srow-value">{percentLabel(value)}</span>
    </label>
  );
}
