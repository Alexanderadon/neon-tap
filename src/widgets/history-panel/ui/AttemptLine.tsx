import { dict, fmt } from '@/shared/i18n';
import { bestOf, playsOf, trendOf, useHistory } from '@/entities/history';
import { formatScore } from '../lib/format';
import { TrendMark } from './TrendMark';
import './history.css';

/**
 * Compact line for the result screen: «Попытка №N · лучший результат … · тренд ↑».
 * The run being shown is already in the history, so its number is the play count.
 */
export function AttemptLine({ trackId }: { trackId: string }) {
  const plays = useHistory((h) => playsOf(h, trackId));
  const best = useHistory((h) => bestOf(h, trackId));
  const trend = useHistory((h) => trendOf(h, trackId));
  if (plays === 0) return null;
  return (
    <div className="attempt-line">
      <span>{fmt(dict.attemptN, { n: plays })}</span>
      <span>·</span>
      <span>{best ? fmt(dict.bestShort, { score: formatScore(best.score) }) : dict.bestNone}</span>
      {plays > 1 && (
        <>
          <span>·</span>
          <span>
            {dict.trendWord} <TrendMark delta={trend} />
          </span>
        </>
      )}
    </div>
  );
}
