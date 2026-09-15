import { useEffect, useState } from 'react';
import { dict, fmt, plural } from '@/shared/i18n';
import { leaderboard, type LeaderboardEntry } from '@/shared/api/leaderboard';
import { Icon, ListRow, Panel, PlaceChip, SegmentsPulse, StatePanel, Tag } from '@/shared/ui';
import { useSettings } from '@/entities/settings';
import { bestOf, playsOf, useHistory } from '@/entities/history';
import { formatAccuracy, formatScore } from '@/shared/lib/format';
import './history.css';

const SHOW = 10;

type Online = { status: 'loading' } | { status: 'off' } | { status: 'ready'; top: LeaderboardEntry[]; position: number | null };

/**
 * Records of one track the way a child reads them: my best run in the score panel (the tag pair
 * «ЛИЧНЫЙ РЕКОРД | 12 ПОПЫТОК» riding on its top edge), then the people above and below me as
 * list rows, and «ТВОЁ МЕСТО: 4» under them. Loading / no connection / nobody yet are one state
 * panel in place of the list; the record panel stays whatever happens online.
 */
export function HistoryPanel({ trackId }: { trackId: string }) {
  const best = useHistory((h) => bestOf(h, trackId));
  const plays = useHistory((h) => playsOf(h, trackId));
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
      <div className="history-tab">
        {best ? (
          <>
            <Tag shape="left">{dict.personalBest}</Tag>
            <Tag variant="dark" shape="right">
              {fmt(dict.attemptsCount, { n: plays, noun: plural(plays, dict.playsNoun) })}
            </Tag>
          </>
        ) : (
          <Tag variant="dark">{dict.personalBest}</Tag>
        )}
      </div>
      <Panel layout="score" className="history-best">
        {best ? (
          <>
            <div className="history-score">{formatScore(best.score)}</div>
            <div className="history-stats">
              <span>
                {dict.accuracy} <b>{formatAccuracy(best.accuracy)}</b>
              </span>
              <span>
                {dict.comboShort} <b>{best.maxCombo}</b>
              </span>
              <span>
                {dict.rank} <b className="history-rank">{best.rank}</b>
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="history-score history-score-none">{dict.bestNone}</div>
            <div className="history-stats">
              <span>{dict.noAttempts}</span>
            </div>
          </>
        )}
      </Panel>

      {online.status === 'loading' && <StatePanel icon={<SegmentsPulse />}>{dict.onlineLoading}</StatePanel>}
      {online.status === 'off' && (
        <StatePanel icon={<Icon name="cloud-off" size={32} />}>
          <b>{dict.offline}</b> · {dict.offlineHint}
        </StatePanel>
      )}
      {online.status === 'ready' && rows.length === 0 && <StatePanel icon={<Icon name="trophy" size={32} />}>{dict.onlineEmpty}</StatePanel>}
      {online.status === 'ready' && rows.length > 0 && (
        <ol className="history-list">
          {rows.map((e, i) => (
            <ListRow
              key={`${e.name}-${i}`}
              lead={<PlaceChip place={i + 1} />}
              name={e.name}
              score={formatScore(e.score)}
              me={!!me && e.name.toLocaleLowerCase() === me}
            />
          ))}
          {!meInTop && best && online.position !== null && (
            <ListRow lead={<PlaceChip place={online.position} />} name={nickname || dict.you} score={formatScore(best.score)} me />
          )}
        </ol>
      )}
      {online.status === 'ready' && online.position !== null && (
        <div className="history-place">
          <Tag variant="dark">{fmt(dict.onlineYourPlace, { n: online.position })}</Tag>
        </div>
      )}
    </div>
  );
}
