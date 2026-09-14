import { useCallback, useEffect, useState } from 'react';
import { dict } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { Button, Screen } from '@/shared/ui';
import { duels, duelIdFromUrl, type Duel } from '@/shared/api/duels';
import { CATALOG, TrackCover, loadChart } from '@/entities/track';
import { startSession } from '@/entities/play-session';
import { acceptDuel, setPendingDuel, usePendingDuel } from '@/entities/duel';
import './duel-page.css';

/** Take the duel id out of the address bar (other flags stay), so a reload does not reopen the challenge. */
function dropDuelParam(): void {
  const url = new URL(location.href);
  url.searchParams.delete('duel');
  history.replaceState(null, '', url.pathname + (url.search || ''));
}

type State = { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready'; duel: Duel };

/**
 * The challenge screen a friend lands on from a duel link: who scored what on which track, and
 * one big "Play". Accepting starts the same track; the run then answers the duel on the result screen.
 */
export function DuelPage() {
  const pending = usePendingDuel();
  const [state, setState] = useState<State>(pending ? { kind: 'ready', duel: pending } : { kind: 'loading' });

  useEffect(() => {
    if (pending) return;
    const id = duelIdFromUrl();
    if (!id) {
      setState({ kind: 'missing' });
      return;
    }
    let alive = true;
    duels.fetch(id).then((duel) => {
      if (!alive) return;
      if (duel) setPendingDuel(duel);
      setState(duel ? { kind: 'ready', duel } : { kind: 'missing' });
    });
    return () => {
      alive = false;
    };
  }, [pending]);

  const toMenu = useCallback(() => {
    setPendingDuel(null);
    dropDuelParam();
    navigate('menu');
  }, []);

  const play = useCallback(async () => {
    if (state.kind !== 'ready') return;
    const chart = await loadChart(state.duel.track);
    acceptDuel(state.duel);
    dropDuelParam();
    startSession(chart, 'catalog');
    navigate('game');
  }, [state]);

  const track = state.kind === 'ready' ? CATALOG.find((t) => t.id === state.duel.track) : undefined;
  const known = state.kind === 'ready' && !!track;

  return (
    <Screen center className="duel-page">
      {state.kind === 'loading' && <div className="duel-page-status">{dict.duelLoading}</div>}
      {(state.kind === 'missing' || (state.kind === 'ready' && !known)) && (
        <>
          <div className="duel-page-status">{dict.duelMissing}</div>
          <Button onClick={toMenu}>{dict.toMenu}</Button>
        </>
      )}
      {state.kind === 'ready' && track && (
        <>
          <div className="duel-page-kicker">{dict.duelKicker}</div>
          <TrackCover id={track.id} genre={track.genre} title={track.title} className="duel-page-cover" />
          <h1 className="duel-page-title">{track.title}</h1>
          <div className="duel-page-host">
            <span className="duel-page-name">{state.duel.host.name}</span>
            <span className="duel-page-score">{state.duel.host.score.toLocaleString('ru-RU')}</span>
          </div>
          <div className="duel-page-question">{dict.duelQuestion}</div>
          <div className="duel-page-actions">
            <Button size="xl" onClick={() => void play()} autoFocus>
              {dict.duelPlay}
            </Button>
            <Button variant="ghost" onClick={toMenu}>
              {dict.duelLater}
            </Button>
          </div>
        </>
      )}
    </Screen>
  );
}
