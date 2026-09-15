import { dict, fmt } from '@/shared/i18n';
import type { Duel } from '@/shared/api/duels';
import { formatScore } from '@/shared/lib/format';
import { Avatar, Icon, ListRow, StatePanel, Tag } from '@/shared/ui';
import { CATALOG, TrackCover } from '@/entities/track';
import { duelVerdict } from '@/entities/duel';
import { avatarArtOf } from '@/entities/avatar';
import { duelStatus, type DuelStatus } from '../model/duelStatus';
import type { MyDuelsState } from '../model/useMyDuels';
import './duel-list.css';

interface Props {
  state: MyDuelsState;
  /** Tap on a duel row: play that track again (an answer to the answers). */
  onPlay?: (trackId: string) => void;
}

/**
 * The duels hosted from this device, one group each: the duel row (cover 40, track, my score,
 * the verdict tag), then a list row per answer — who, their score, «ПОБИЛ» in magenta or
 * «ПОЗАДИ» in grey. Empty: a state panel that says where a duel comes from.
 */
export function DuelList({ state, onPlay }: Props) {
  const { mine, loaded } = state;
  if (mine.length === 0) {
    return <StatePanel icon={<Icon name="duel" size={32} />}>{dict.duelsEmpty}</StatePanel>;
  }
  return (
    <div className="duels">
      {mine.map((d) => {
        const duel = loaded[d.id];
        const track = CATALOG.find((t) => t.id === d.track);
        const title = track?.title ?? d.track;
        const status = duelStatus(duel);
        return (
          <section key={d.id} className="duels-group" aria-label={title}>
            <button type="button" className="duel-row" onClick={onPlay ? () => onPlay(d.track) : undefined} aria-label={fmt(dict.duelRowAria, { title })}>
              <span className="duel-thumb" aria-hidden="true">
                <TrackCover id={d.track} genre={track?.genre} />
              </span>
              <span className="duel-two">
                <b className="duel-title">{title}</b>
                <small className="duel-sub">{subLine(status, duel)}</small>
              </span>
              <StatusTag status={status} />
            </button>
            {duel &&
              duel.replies.map((r) => {
                const beat = duelVerdict(duel.host, r) === 'beaten';
                return (
                  <ListRow
                    key={`${r.name}-${r.at}`}
                    as="div"
                    lead={<Avatar name={r.name} tone="other" art={avatarArtOf(r.avatar)} />}
                    name={r.name}
                    score={formatScore(r.score)}
                    end={beat ? <Tag variant="bad">{dict.duelBeat}</Tag> : <Tag variant="dark">{dict.duelBehind}</Tag>}
                  />
                );
              })}
          </section>
        );
      })}
    </div>
  );
}

function subLine(status: DuelStatus, duel: Duel | null | undefined) {
  if (status === 'loading') return dict.loading;
  if (status === 'closed') return dict.duelClosedHint;
  if (status === 'waiting') return dict.duelNoReplies;
  return (
    <>
      {dict.duelMine} <b>{formatScore(duel!.host.score)}</b>
    </>
  );
}

function StatusTag({ status }: { status: DuelStatus }) {
  switch (status) {
    case 'ahead':
      return <Tag>{dict.duelAhead}</Tag>;
    case 'beaten':
      return <Tag variant="bad">{dict.duelBeat}</Tag>;
    case 'closed':
      return <Tag variant="dark">{dict.duelClosed}</Tag>;
    default:
      return <Tag variant="dark">{dict.duelWaiting}</Tag>;
  }
}
