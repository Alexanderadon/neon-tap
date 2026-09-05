import { dict } from '@/shared/i18n';
import { trendDirection, type TrendDirection } from '@/entities/history';
import './history.css';

const ARROW: Record<TrendDirection, string> = { up: '↑', down: '↓', flat: '→' };
const LABEL: Record<TrendDirection, string> = { up: dict.trendUp, down: dict.trendDown, flat: dict.trendFlat };

/** Trend arrow (accuracy delta over the last attempts) with colour and an accessible label. */
export function TrendMark({ delta }: { delta: number }) {
  const dir = trendDirection(delta);
  return (
    <span className={`history-trend history-trend-${dir}`} title={LABEL[dir]} aria-label={LABEL[dir]}>
      {ARROW[dir]}
      {dir !== 'flat' && <small> {(Math.abs(delta) * 100).toFixed(1)}</small>}
    </span>
  );
}
