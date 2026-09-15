import type { CSSProperties } from 'react';
import { dict } from '@/shared/i18n';
import './calibration.css';

interface Props {
  /** Marker position 0..100 (`meterPercent`); `null` hides the marker until the first tap. */
  percent: number | null;
  className?: string;
  style?: CSSProperties;
}

/** TapMeter 28 (screens-onboard notes): «раньше … позже» 13 w55 + an 8 px track with a cyan centre tick and a gold 16 px marker. */
export function TapMeter({ percent, className, style }: Props) {
  return (
    <div className={['tapmeter', className].filter(Boolean).join(' ')} style={style} aria-hidden="true">
      <div className="tapmeter-row">
        <span>{dict.calibEarly}</span>
        <span>{dict.calibLate}</span>
      </div>
      <div className="tapmeter-track">
        <i className="tapmeter-mid" />
        {percent !== null && <i className="tapmeter-mark" style={{ left: `${percent.toFixed(2)}%` }} />}
      </div>
    </div>
  );
}
