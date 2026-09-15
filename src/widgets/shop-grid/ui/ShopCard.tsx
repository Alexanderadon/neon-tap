import { useId } from 'react';
import { dict, fmt } from '@/shared/i18n';
import { CrystalIcon, Difficulty, Icon, RingCountdown, Star, Tag } from '@/shared/ui';
import { TrackCover } from '@/entities/track';
import type { ShopItem } from '../model/shopItems';

/** A preview: this many seconds (the ring around the disc drains once over the same time). */
export const PREVIEW_SEC = 5;

interface Props {
  item: ShopItem;
  /** Wallet balance — a price above it is magenta. */
  balance: number;
  /** This card's five-second listen is playing. */
  previewing: boolean;
  /** Just bought in this visit: the «КУПЛЕНО» tag gets its one shine. */
  justBought: boolean;
  onPreview: () => void;
  /** Tap on the card: open the purchase sheet (or, when owned, go to the deck). */
  onOpen: () => void;
}

/** The condition tag: «ПРЕМИУМ» (gold) · «★ ЕЩЁ N» (dark) · «КУПЛЕНО» (dark, one shine after the purchase). */
function ConditionTag({ item, justBought, starId }: { item: ShopItem; justBought: boolean; starId: string }) {
  if (item.kind === 'owned') {
    return (
      <Tag variant="dark" shine={justBought}>
        {dict.shopBought}
      </Tag>
    );
  }
  if (item.kind === 'premium') return <Tag>{dict.shopPremium}</Tag>;
  return (
    <Tag variant="dark" icon={<Star id={starId} on />}>
      {fmt(dict.shopStarsMore, { n: item.starsShort })}
    </Tag>
  );
}

/**
 * ShopCard 335 × 96, r 24 — the deck card laid on its side: the cover (192, slice) pinned to the
 * left under a veil that runs into the panel face, the preview disc 40 on it, the title 20/700 and
 * the meta row (flame chip · condition tag · price) over the face. Owned cards dim to 55 %.
 */
export function ShopCard({ item, balance, previewing, justBought, onPreview, onOpen }: Props) {
  const { track, price, kind } = item;
  const owned = kind === 'owned';
  const short = !owned && price > balance;
  const starId = useId().replace(/:/g, '');
  const cls = ['scard', owned && 'scard-owned', previewing && 'scard-playing'].filter(Boolean).join(' ');
  const openAria = owned
    ? `${track.title} · ${dict.shopOpenOwned}`
    : `${dict.shopBuy} · ${track.title} · ${price} ${short ? `· ${fmt(dict.shopNotEnough, { n: price - balance })}` : ''}`.trim();
  return (
    <article className={cls} data-track={track.id}>
      <div className="scard-art" aria-hidden="true">
        <TrackCover id={track.id} genre={track.genre} title={track.title} />
      </div>
      <button type="button" className="scard-body" onClick={onOpen} aria-label={openAria}>
        <span className="scard-title">{track.title}</span>
        <span className="scard-meta">
          <Difficulty stars={track.stars} />
          <ConditionTag item={item} justBought={justBought} starId={starId} />
          {!owned && (
            <span className={short ? 'scard-price scard-price-no' : 'scard-price'}>
              <span className="scard-price-icon">
                <CrystalIcon size={20} />
              </span>
              {price}
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        className={previewing ? 'scard-pv scard-pv-on' : 'scard-pv'}
        onClick={onPreview}
        aria-label={`${previewing ? dict.shopPreviewStop : dict.shopPreview} · ${track.title}`}
        aria-pressed={previewing}
      >
        {previewing ? (
          <RingCountdown size={40} seconds={PREVIEW_SEC} stroke={2} track={false}>
            <Icon name="stop" size={16} />
          </RingCountdown>
        ) : (
          <Icon name="play" size={24} />
        )}
      </button>
    </article>
  );
}
