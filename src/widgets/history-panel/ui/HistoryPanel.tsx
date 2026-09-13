import { useEffect, useState } from 'react';
import { dict, fmt } from '@/shared/i18n';
import { leaderboard, type LeaderboardEntry } from '@/shared/api/leaderboard';
import { useSettings } from '@/entities/settings';
import { bestOf, useHistory } from '@/entities/history';
import { formatScore } from '../lib/format';
import './history.css';

const SHOW = 10;

type Online = { status: 'loading' } | { status: 'off' } | { status: 'ready'; top: LeaderboardEntry[]; position: number | null };

/**
 * Records of one track the way a child reads them: my best score, then the people above and
 * below me with their scores. Nothing else — no dates, no percentages, no trends.
 */
export function HistoryPanel({ trackId }: { trackId: string }) {
  const best = useHistory((h) => bestOf(h, trackId));
  const nickname = useSettings((s) => s.nickname);
  const [online, setOnline] = useState<Online>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    setOnline({ status: 'loading' });
    leaderboard
      .fetchTop(trackId, nickname || undefined)
      .then((r) => {
        if (!alive) return;
        setOnline(r.enabled ? { status: 'ready', top: r.top, position: r.position } : { status: 'off' });
      })
      .catch(() => alive && setOnline({ status: 'off' }));
    return () => {
      alive = false;
    };
  }, [trackId, nickname]);

  const me = nickname.toLocaleLowerCase();
  const rows = online.status === 'ready' ? online.top.slice(0, SHOW) : [];
  const meInTop = rows.some((e) => e.name.toLocaleLowerCase() === me);

  return (
    <div className="history">
      <div className="history-best">
        <div className="history-best-label">{dict.personalBest}</div>
        <div className="history-best-score">{best ? formatScore(best.score) : dict.bestNone}</div>
      </div>

      {online.status === 'loading' && <div className="history-empty">{dict.onlineLoading}</div>}
      {online.status === 'ready' && rows.length === 0 && <div className="history-empty">{dict.onlineEmpty}</div>}
      {online.status === 'ready' && rows.length > 0 && (
        <ol className="history-list">
          {rows.map((e, i) => (
            <li key={`${e.name}-${i}`} className={`history-row${e.name.toLocaleLowerCase() === me && me ? ' history-row-me' : ''}`}>
              <span className="history-pos">{i + 1}</span>
              <span className="history-name">{e.name}</span>
              <span className="history-score">{formatScore(e.score)}</span>
            </li>
          ))}
          {!meInTop && best && online.position !== null && (
            <li className="history-row history-row-me">
              <span className="history-pos">{online.position}</span>
              <span className="history-name">{nickname || dict.you}</span>
              <span className="history-score">{formatScore(best.score)}</span>
            </li>
          )}
        </ol>
      )}
      {online.status === 'ready' && online.position !== null && <div className="history-place">{fmt(dict.onlineYourPlace, { n: online.position })}</div>}
    </div>
  );
}
