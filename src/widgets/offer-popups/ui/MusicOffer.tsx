import type { RefObject } from 'react';
import { dict, fmt, plural } from '@/shared/i18n';
import { formatCount } from '@/shared/lib/format';
import { Coin, CrystalIcon, Icon, Tag } from '@/shared/ui';
import { TrackCover } from '@/entities/track';
import { MUSIC_PACK_SKU } from '@/entities/offers';
import { MUSIC_PACK_TRACKS, MUSIC_PACK_VALUE, type BuyOfferResult } from '@/features/buy-offer';
import { OfferSheet } from './OfferSheet';
import { HeroCards } from './heroes';

interface Props {
  onClose: () => void;
  onResult: (r: BuyOfferResult) => void;
  primaryRef: RefObject<HTMLDivElement>;
}

/**
 * The music pack («8 ТРЕКОВ»): the fan of cards, «все премиум-треки сразу», the coins «8 · треков»
 * and what they would cost in crystals, the eight covers in a row, the pack's price on the button.
 */
export function MusicOffer({ onClose, onResult, primaryRef }: Props) {
  const n = MUSIC_PACK_TRACKS.length;
  return (
    <OfferSheet
      kind="music"
      sku={MUSIC_PACK_SKU}
      title={fmt(dict.offerMusicTag, { n, noun: plural(n, dict.offerTracksNoun) })}
      placeholder={<HeroCards />}
      tags={<Tag icon={<Icon name="note" size={16} />}>{fmt(dict.offerMusicTag, { n, noun: plural(n, dict.offerTracksNoun) })}</Tag>}
      benefit={dict.offerMusicBenefit}
      coins={
        <>
          <Coin icon={<Icon name="note" size={20} />} value={n} caption={plural(n, dict.offerTracksNoun)} animate delay={0.3} />
          <Coin
            icon={
              <span className="offer-cy">
                <CrystalIcon size={20} />
              </span>
            }
            value={formatCount(MUSIC_PACK_VALUE)}
            caption={dict.offerInCrystals}
            tone="cy"
            animate
            delay={0.4}
          />
        </>
      }
      note={
        <span className="offer-covers">
          {MUSIC_PACK_TRACKS.map((t) => (
            <span key={t.id} className="offer-cover" title={t.title}>
              <TrackCover id={t.id} genre={t.genre} title={t.title} />
            </span>
          ))}
        </span>
      }
      onClose={onClose}
      onResult={onResult}
      primaryRef={primaryRef}
    />
  );
}
