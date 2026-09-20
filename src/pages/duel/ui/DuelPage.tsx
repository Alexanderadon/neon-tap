import { useCallback, useEffect, useState } from 'react';
import { dict, fmt } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { sfxUi } from '@/shared/lib/audio';
import { ActionZone, Avatar, Difficulty, Disc, Icon, ObjButton, PrimaryAction, Screen, Stars, StatePanel, SubHeader, Tag, Trio } from '@/shared/ui';
import { formatScore } from '@/shared/lib/format';
import { duels, duelIdFromUrl, type Duel } from '@/shared/api/duels';
import { hexToRgba } from '@/shared/lib/render';
import { CATALOG, CoverScene, TrackCover, trackTint, loadChart, type TrackMeta } from '@/entities/track';
import { startSession } from '@/entities/play-session';
import { starsForTrack, useProgress } from '@/entities/progress';
import { acceptDuel, setPendingDuel, usePendingDuel } from '@/entities/duel';
import { avatarArtOf } from '@/entities/avatar';
import { TopBar } from '@/widgets/top-bar';
import './duel-page.css';

/** Take the duel id out of the address bar (other flags stay), so a reload does not reopen the challenge. */
function dropDuelParam(): void {
  const url = new URL(location.href);
  url.searchParams.delete('duel');
  history.replaceState(null, '', url.pathname + (url.search || ''));
}

type State = { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready'; duel: Duel };

/**
 * The challenge screen a friend lands on from a duel link (screens-game.html, frames 14–15): the
 * deck card of the track with the host's avatar and score in its centre, and one big «ИГРАТЬ».
 * Accepting starts the same track; the run then answers the duel on the result screen.
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

  const toMenu = useCallback((params?: Record<string, string>) => {
    sfxUi();
    setPendingDuel(null);
    dropDuelParam();
    navigate('menu', params);
  }, []);

  const play = useCallback(async () => {
    if (state.kind !== 'ready') return;
    sfxUi();
    const chart = await loadChart(state.duel.track);
    acceptDuel(state.duel);
    dropDuelParam();
    startSession(chart, 'catalog');
    navigate('game');
  }, [state]);

  const track = state.kind === 'ready' ? CATALOG.find((t) => t.id === state.duel.track) : undefined;
  const duel = state.kind === 'ready' && track ? state.duel : null;
  const missing = state.kind === 'missing' || (state.kind === 'ready' && !track);

  return (
    <Screen frame className="duelp">
      <CoverScene position="fixed" id={track?.id} genre={track?.genre} />
      <TopBar />
      <SubHeader
        tag={<Tag>{dict.duelKicker}</Tag>}
        text={duel ? fmt(dict.duelInvite, { name: duel.host.name }) : missing ? dict.duelFromLink : dict.duelLoading}
      />

      {missing ? (
        <StatePanel className="duelp-missing" icon={<Icon name="duel" size={32} />}>
          {dict.duelGone}
        </StatePanel>
      ) : (
        <div className="duelp-stage">
          <DuelCard track={track} duel={duel} />
        </div>
      )}

      <ActionZone className="duelp-bottom">
        <Trio>
          {missing ? (
            <ObjButton
              icon={<Icon name="bag" />}
              label={dict.shop}
              onClick={() => {
                sfxUi();
                navigate('shop');
              }}
            />
          ) : (
            <ObjButton icon={<Icon name="cross" />} label={dict.duelLater} onClick={() => toMenu()} />
          )}
          <ObjButton
            icon={<Icon name="trophy" />}
            label={dict.records}
            onClick={() => toMenu(duel ? { view: 'records', track: duel.track } : { view: 'records' })}
          />
          <ObjButton icon={<Icon name="user" />} label={dict.profile} onClick={() => toMenu({ view: 'profile' })} />
        </Trio>
        {duel ? (
          <PrimaryAction
            lead={
              <Disc>
                <Icon name="play" />
              </Disc>
            }
            label={dict.duelPlay}
            sub={fmt(dict.beatScore, { score: formatScore(duel.host.score) })}
            beat
            autoFocus
            onClick={() => void play()}
          />
        ) : missing ? (
          <PrimaryAction
            lead={
              <Disc>
                <Icon name="home" />
              </Disc>
            }
            label={dict.toMenu}
            sub={dict.pickTrack}
            beat
            onClick={() => toMenu()}
          />
        ) : (
          <PrimaryAction
            tone="locked"
            lead={
              <Disc>
                <Icon name="hourglass" />
              </Disc>
            }
            label={dict.duelPlay}
            sub={dict.duelLoading}
            disabled
          />
        )}
      </ActionZone>
    </Screen>
  );
}

/** The deck card 292 × 420 as on the menu (cover full-bleed, title, stars, flame, rank) with the host's plate in its centre. */
function DuelCard({ track, duel }: { track?: TrackMeta; duel: Duel | null }) {
  const best = useProgress((s) => (track ? s.tracks[track.id] : undefined));
  const stars = starsForTrack(best);
  const rank = best?.rank;
  const gold = rank === 'S' || rank === 'SS';
  // The centre card glows in its cover's accent, as on the deck.
  const glow = track ? { boxShadow: `var(--sh-card), 0 0 48px ${hexToRgba(trackTint(track.id, track.genre), 0.3)}` } : undefined;
  return (
    <article className={track ? 'duelp-card' : 'duelp-card duelp-card-plain'} style={glow}>
      <div className="duelp-art" aria-hidden="true">
        {track && <TrackCover id={track.id} genre={track.genre} />}
      </div>
      {duel && (
        <Tag shape="flush" className="duelp-flush" icon={<Icon name="duel" />}>
          {dict.duelQuestion}
        </Tag>
      )}
      <div className="duelp-plate">
        {duel ? (
          <>
            <Avatar name={duel.host.name} size={48} tone="other" art={avatarArtOf(duel.host.avatar)} />
            <span className="duelp-score">{formatScore(duel.host.score)}</span>
            <Tag variant="dark">{best ? fmt(dict.yourBest, { score: formatScore(best.score) }) : dict.notPlayedYet}</Tag>
          </>
        ) : (
          <Tag variant="dark">{dict.duelLoading}</Tag>
        )}
      </div>
      <div className="duelp-text">
        <h1 className={track ? 'duelp-title' : 'duelp-title duelp-title-dim'}>{track?.title ?? dict.duelKicker}</h1>
        <div className="duelp-meta">
          <Stars value={stars} size="md" />
          {track && <Difficulty stars={track.stars} />}
          {rank && <span className={gold ? 'duelp-rank duelp-rank-gold' : 'duelp-rank'}>{rank}</span>}
        </div>
      </div>
    </article>
  );
}
