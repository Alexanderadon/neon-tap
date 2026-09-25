import type { ReactNode } from 'react';
import { dict, fmt } from '@/shared/i18n';
import { ActionZone, CrystalIcon, Disc, Icon, ObjButton, PrimaryAction, Trio } from '@/shared/ui';
import { trackTint, type TrackMeta } from '@/entities/track';
import { dropSoonText, songsText, type LockState } from '@/widgets/track-list';

/** One of the three doors in the bottom row; the door the player stands in becomes «В меню». */
export interface Door {
  key: 'shop' | 'records' | 'profile' | 'menu';
  onTap: () => void;
  badge?: number;
}

interface Props {
  doors: readonly [Door, Door, Door];
  track: TrackMeta;
  lock: LockState;
  /** The deck's «Своя музыка» card is focused: the primary is «ВЫБРАТЬ ФАЙЛ» (the custom-song screen) instead of a track's. */
  custom: boolean;
  /** How many stars the player has (the locked sub-line «★ 22 из 25»). */
  stars: number;
  busy: boolean;
  onPlay: () => void;
  /** The deck's «Новые треки — по понедельникам» card is focused: nothing to play, a disabled «СКОРО». */
  slot?: boolean;
  /** Saved songs: on the «Своя музыка» card the primary becomes «МОЯ МУЗЫКА / 3 песни» once there is one. */
  songs?: number;
  /** The clock the weekly locks were computed with (`CatalogState.nowMs`) — «Выйдет через N дн.» under a weekly track's «СКОРО». */
  nowMs?: number;
}

const DOOR_ICON: Record<Door['key'], ReactNode> = {
  shop: <Icon name="bag" />,
  records: <Icon name="trophy" />,
  profile: <Icon name="user" />,
  menu: <Icon name="home" />,
};
const DOOR_LABEL: Record<Door['key'], string> = { shop: dict.shop, records: dict.records, profile: dict.profile, menu: dict.toMenu };

/**
 * The bottom action zone, identical on every menu screen: three object buttons (48) and the
 * 64 px primary — «ИГРАТЬ / track» with the play disc, or «ОТКРЫТЬ» with a lock while the
 * focused track is closed (a premium or weekly track leads to the shop instead), a disabled
 * «СКОРО» on a weekly track not out yet and on the empty-week card, or «ВЫБРАТЬ ФАЙЛ» on the
 * deck's «Своя музыка» card («МОЯ МУЗЫКА / N песен» once songs are saved).
 */
export function MenuDock({ doors, track, lock, custom, stars, busy, onPlay, slot = false, songs = 0, nowMs = 0 }: Props) {
  let primary: ReactNode;
  if (custom && songs > 0) {
    primary = (
      <PrimaryAction
        lead={
          <Disc>
            <Icon name="note" size={24} />
          </Disc>
        }
        label={dict.deckMyMusic}
        sub={songsText(songs)}
        beat={!busy}
        disabled={busy}
        onClick={onPlay}
      />
    );
  } else if (custom) {
    primary = (
      <PrimaryAction
        lead={
          <Disc>
            <Icon name="file" size={24} />
          </Disc>
        }
        label={dict.chooseFile}
        sub={dict.fileFormats}
        beat={!busy}
        disabled={busy}
        onClick={onPlay}
      />
    );
  } else if (slot || (lock.locked && lock.drop?.soon)) {
    primary = (
      <PrimaryAction
        tone="locked"
        lead={
          <Disc>
            <Icon name="lock" size={24} />
          </Disc>
        }
        label={dict.dropSoon}
        sub={slot || !lock.drop ? dict.dropSlotLine : dropSoonText(lock.drop, nowMs)}
        disabled
        aria-label={
          slot || !lock.drop ? `${dict.dropSlotTitle} · ${dict.dropSlotLine}` : `${dict.dropSoon} · ${track.title} · ${dropSoonText(lock.drop, nowMs)}`
        }
      />
    );
  } else if (lock.locked && (lock.premium || lock.drop)) {
    primary = (
      <PrimaryAction
        lead={
          <Disc>
            <CrystalIcon size={24} halo />
          </Disc>
        }
        label={dict.openTrack}
        sub={
          <>
            {fmt(dict.forCrystals, { n: lock.price })} <CrystalIcon size={13} />
          </>
        }
        beat
        disabled={busy}
        onClick={onPlay}
        aria-label={`${fmt(dict.deckOpenFor, { n: lock.price })} · ${track.title}`}
      />
    );
  } else if (lock.locked) {
    primary = (
      <PrimaryAction
        tone="locked"
        lead={
          <Disc>
            <Icon name="lock" size={24} />
          </Disc>
        }
        label={dict.openTrack}
        sub={fmt(dict.starsOfNeed, { have: Math.min(stars, lock.need), need: lock.need })}
        disabled
        aria-label={fmt(dict.deckNeedStars, { n: Math.max(0, lock.need - stars) })}
      />
    );
  } else {
    primary = (
      <PrimaryAction
        lead={
          <Disc>
            <Icon name="play" size={24} />
          </Disc>
        }
        label={dict.play}
        sub={track.title}
        tint={trackTint(track.id, track.genre)}
        beat={!busy}
        disabled={busy}
        onClick={onPlay}
        aria-label={fmt(dict.deckPlayAria, { title: track.title })}
      />
    );
  }
  return (
    <ActionZone>
      <Trio>
        {doors.map((d) => (
          <ObjButton
            key={d.key}
            icon={DOOR_ICON[d.key]}
            label={DOOR_LABEL[d.key]}
            badge={d.badge}
            onClick={d.onTap}
            aria-label={d.badge ? `${DOOR_LABEL[d.key]} · ${fmt(dict.shopAffordable, { n: d.badge })}` : undefined}
          />
        ))}
      </Trio>
      {primary}
    </ActionZone>
  );
}
