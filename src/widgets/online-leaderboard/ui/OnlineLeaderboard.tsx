import { dict, fmt } from '@/shared/i18n';
import { useSettings } from '@/entities/settings';
import type { ChartSource } from '@/entities/play-session';
import type { PlayResult } from '@/entities/score';
import { NicknameDialog, useSubmitScore } from '@/features/submit-score';
import './online.css';

const SHOW = 10;

interface Props {
  result: PlayResult;
  source: ChartSource;
}

/**
 * «Онлайн-рекорды» on the result screen: top 10 + the player's position. Hidden entirely when
 * the backend is not configured (a muted hint appears only with the debug overlay on).
 */
export function OnlineLeaderboard({ result, source }: Props) {
  const { status, top, position, improved, skipNickname } = useSubmitScore(result, source);
  const nickname = useSettings((s) => s.nickname);
  const debug = useSettings((s) => s.debugOverlay);

  if (status === 'idle' || status === 'probing') return null;
  if (status === 'disabled') return debug ? <div className="online-debug">{dict.onlineDisabledHint}</div> : null;

  const me = nickname.toLocaleLowerCase();
  const rows = top.slice(0, SHOW);

  return (
    <>
      <section className="online" aria-live="polite">
        <div className="online-head">
          <span className="online-title">{dict.onlineRecords}</span>
          {position !== null && <span className="online-place">{fmt(dict.onlineYourPlace, { n: position })}</span>}
        </div>
        {status === 'need-name' || status === 'submitting' ? (
          <div className="online-status">{dict.onlineLoading}</div>
        ) : rows.length === 0 ? (
          <div className="online-status">{dict.onlineEmpty}</div>
        ) : (
          <ol className="online-list">
            {rows.map((e, i) => (
              <li key={`${e.name}-${i}`} className={`online-row ${e.name.toLocaleLowerCase() === me && me ? 'online-row-me' : ''}`}>
                <span className="online-pos">{i + 1}</span>
                <span className="online-name">{e.name}</span>
                <span className="online-score">{e.score.toLocaleString('ru-RU')}</span>
                <span className="online-acc">{(e.accuracy * 100).toFixed(1)}%</span>
                <span className={`online-rank rank-${e.rank}`}>{e.rank}</span>
              </li>
            ))}
          </ol>
        )}
        {status === 'done' && improved && <div className="online-status">{dict.onlineSubmitted}</div>}
        {status === 'error' && <div className="online-status online-status-error">{dict.onlineSubmitFailed}</div>}
      </section>
      <NicknameDialog open={status === 'need-name'} onSkip={skipNickname} />
    </>
  );
}
