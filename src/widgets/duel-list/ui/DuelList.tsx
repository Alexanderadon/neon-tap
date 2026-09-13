import { useEffect, useState } from 'react';
import { dict } from '@/shared/i18n';
import { duels, type Duel } from '@/shared/api/duels';
import { CATALOG } from '@/entities/track';
import { duelVerdict, myDuels } from '@/entities/duel';
import './duel-list.css';

const SHOW = 6;

/** The duels hosted from this device: track, my score, and who answered — beat me or still behind. */
export function DuelList() {
  const mine = myDuels().slice(0, SHOW);
  const [loaded, setLoaded] = useState<Record<string, Duel | null>>({});

  useEffect(() => {
    let alive = true;
    for (const d of mine) {
      duels.fetch(d.id).then((duel) => {
        if (alive) setLoaded((m) => ({ ...m, [d.id]: duel }));
      });
    }
    return () => {
      alive = false;
    };
    // The list is read from storage on every open; ids are the dependency that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine.map((d) => d.id).join(',')]);

  return (
    <section className="duels">
      <h3 className="duels-title">{dict.duelsTitle}</h3>
      {mine.length === 0 && <div className="duels-empty">{dict.duelsEmpty}</div>}
      <ul className="duels-list">
        {mine.map((d) => {
          const duel = loaded[d.id];
          const track = CATALOG.find((t) => t.id === d.track);
          return (
            <li key={d.id} className="duels-item">
              <div className="duels-head">
                <span className="duels-track">{track?.title ?? d.track}</span>
                {duel && <span className="duels-my">{duel.host.score.toLocaleString('ru-RU')}</span>}
              </div>
              {duel === undefined && <div className="duels-sub">{dict.onlineLoading}</div>}
              {duel === null && <div className="duels-sub">{dict.duelMissing}</div>}
              {duel && duel.replies.length === 0 && <div className="duels-sub">{dict.duelNoReplies}</div>}
              {duel && duel.replies.length > 0 && (
                <ul className="duels-replies">
                  {duel.replies.map((r) => {
                    const beat = duelVerdict(duel.host, r) === 'beaten';
                    return (
                      <li key={r.name} className={`duels-reply${beat ? ' is-beat' : ''}`}>
                        <span className="duels-reply-name">{r.name}</span>
                        <span className="duels-reply-score">{r.score.toLocaleString('ru-RU')}</span>
                        <span className="duels-reply-mark">{beat ? dict.duelBeatYou : dict.duelBehindYou}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
