import { dict, plural } from '@/shared/i18n';
import { attemptsOf, bestOf, trendOf, useHistory, type Attempt } from '@/entities/history';
import { sparklinePoints, toPolyline } from '../lib/sparkline';
import { formatDate, formatScore, pct } from '../lib/format';
import { TrendMark } from './TrendMark';
import './history.css';

const SPARK_W = 300;
const SPARK_H = 72;

/** Personal best, accuracy sparkline, trend and the attempt list of one track. */
export function HistoryPanel({ trackId }: { trackId: string }) {
  const attempts = useHistory((h) => attemptsOf(h, trackId));
  const best = useHistory((h) => bestOf(h, trackId));
  const trend = useHistory((h) => trendOf(h, trackId));

  if (attempts.length === 0) return <div className="history-empty">{dict.noAttempts}</div>;

  // Oldest → newest for the chart.
  const series = [...attempts].reverse();
  const points = sparklinePoints(
    series.map((a) => a.accuracy),
    SPARK_W,
    SPARK_H,
    6,
  );

  return (
    <div className="history">
      {best && (
        <div className="history-best">
          <div className={`history-best-rank rank-${best.rank}`}>{best.rank}</div>
          <div className="history-best-label">{dict.personalBest}</div>
          <div className="history-best-score">
            {formatScore(best.score)}
            <small>
              {pct(best.accuracy)} · {formatDate(best.at)}
            </small>
          </div>
        </div>
      )}

      <div className="history-meta">
        <span>
          {attempts.length} {plural(attempts.length, dict.playsNoun)}
        </span>
        <span>
          {dict.trendWord} <TrendMark delta={trend} />
        </span>
      </div>

      <div className="history-spark">
        <div className="history-spark-label">{dict.accuracyByAttempt}</div>
        <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" role="img" aria-label={dict.accuracyByAttempt}>
          {points.length > 1 && <polyline points={toPolyline(points)} fill="none" stroke="#00f0ff" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 2.5} fill={series[i].failed ? '#ff2bd6' : '#00f0ff'} />
          ))}
        </svg>
      </div>

      <ul className="history-list">
        {attempts.map((a, i) => (
          <AttemptRow key={`${a.at}-${i}`} attempt={a} isBest={a === best} />
        ))}
      </ul>
    </div>
  );
}

function AttemptRow({ attempt, isBest }: { attempt: Attempt; isBest: boolean }) {
  return (
    <li className={`history-row ${attempt.failed ? 'history-row-failed' : ''} ${isBest ? 'history-row-best' : ''}`}>
      <span className="history-date">{formatDate(attempt.at)}</span>
      <span className="history-score">{formatScore(attempt.score)}</span>
      <span className="history-acc">{pct(attempt.accuracy)}</span>
      <span className={`history-rank ${attempt.failed ? '' : `rank-${attempt.rank}`}`}>{attempt.failed ? dict.failedShort : attempt.rank}</span>
    </li>
  );
}
