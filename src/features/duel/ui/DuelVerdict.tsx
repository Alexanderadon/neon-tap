import { useEffect, useState } from 'react';
import { dict, fmt } from '@/shared/i18n';
import type { Duel } from '@/shared/api/duels';
import { useSettings } from '@/entities/settings';
import { duelVerdict } from '@/entities/duel';
import type { PlayResult } from '@/entities/score';
import { replyToDuel } from '../model/challenge';
import './duel.css';

/**
 * The one line a duel is about, on the result screen: "Ты побил Сашу! 61 000 против 60 775" or
 * "Саша пока впереди: 60 775 против 45 000". The run is sent back to the duel so the host sees it.
 */
export function DuelVerdict({ duel, result }: { duel: Duel; result: PlayResult }) {
  const nickname = useSettings((s) => s.nickname);
  const [sent, setSent] = useState(false);
  const beaten = !result.failed && duelVerdict(duel.host, result) === 'beaten';

  useEffect(() => {
    if (result.failed || !nickname) return;
    let alive = true;
    void replyToDuel(duel, result, nickname).then((r) => alive && r && setSent(true));
    return () => {
      alive = false;
    };
  }, [duel, result, nickname]);

  const mine = result.score.toLocaleString('ru-RU');
  const theirs = duel.host.score.toLocaleString('ru-RU');
  return (
    <div className={`duel-verdict ${beaten ? 'is-won' : 'is-lost'}`} role="status">
      <div className="duel-verdict-title">{beaten ? dict.duelWon : fmt(dict.duelLost, { name: duel.host.name })}</div>
      <div className="duel-verdict-scores">
        <span className="duel-verdict-mine">{mine}</span>
        <span className="duel-verdict-vs">{dict.duelVs}</span>
        <span className="duel-verdict-theirs">{theirs}</span>
      </div>
      {sent && <div className="duel-verdict-sent">{fmt(dict.duelReplySent, { name: duel.host.name })}</div>}
    </div>
  );
}
