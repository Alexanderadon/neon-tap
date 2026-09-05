import { dict, plural } from '@/shared/i18n';
import { attemptsOf, bestOf, trendOf, useHistory, type Attempt } from '@/entities/history';
import { sparklinePoints, toMarker, toPolyline } from '../lib/sparkline';
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
          {/* Markers are zero-length round-capped strokes: with non-scaling-stroke they stay
              circular under the preserveAspectRatio="none" stretch (a <circle> would be squashed). */}
          {points.map((p, i) => (
            <path
              key={i}
              d={toMarker(p)}
              fill="none"
              stroke={series[i].failed ? '#ff2bd6' : '#00f0ff'}
              strokeWidth={i === points.length - 1 ? 8 : 5}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
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
