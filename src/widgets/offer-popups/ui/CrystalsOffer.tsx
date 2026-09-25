import { useState, type RefObject } from 'react';
import { dict, fmt, plural } from '@/shared/i18n';
import { store } from '@/shared/lib/iap';
import { formatCount } from '@/shared/lib/format';
import { sfxUi } from '@/shared/lib/audio';
import { Coin, Tag } from '@/shared/ui';
import { CRYSTAL_PACKS, type CrystalPackSku } from '@/entities/offers';
import type { BuyOfferResult } from '@/features/buy-offer';
import { OfferSheet } from './OfferSheet';
import { HeroPiles } from './heroes';

/** The pack's picture in `public/offers`: the 4 500 pack has none yet and shows the biggest pile there is (2 000). */
const heroOf = (sku: CrystalPackSku): string => (sku === 'crystals-xl' ? 'crystals-l' : sku);

interface Props {
  onClose: () => void;
  onResult: (r: BuyOfferResult) => void;
  primaryRef: RefObject<HTMLDivElement>;
}

/**
 * The crystals sheet («КРИСТАЛЛЫ»): the piles, the four packs as pressable coins (300 · 700 ·
 * 2 000 · 4 500 in cyan with their prices), the chosen pack's bonus on the benefit line, its price
 * on the button. Never automatic — the wallet's «+» and the shop's not-enough sheet open it.
 */
export function CrystalsOffer({ onClose, onResult, primaryRef }: Props) {
  const [sku, setSku] = useState<CrystalPackSku>('crystals-m');
  const pack = CRYSTAL_PACKS.find((p) => p.sku === sku) ?? CRYSTAL_PACKS[0];
  const benefit = pack.bonusPercent > 0 ? fmt(dict.offerCrystalsBonus, { n: pack.bonusPercent }) : dict.offerCrystalsBase;
  return (
    <OfferSheet
      kind="crystals"
      sku={sku}
      hero={heroOf(sku)}
      title={dict.offerCrystalsTag}
      placeholder={<HeroPiles />}
      tags={<Tag>{dict.offerCrystalsTag}</Tag>}
      benefit={benefit}
      coins={
        <div className="offer-picks" role="radiogroup" aria-label={dict.offerCrystalsTag}>
          {CRYSTAL_PACKS.map((p) => (
            <button
              key={p.sku}
              type="button"
              role="radio"
              aria-checked={p.sku === sku}
              aria-label={fmt(dict.offerPackAria, { n: formatCount(p.crystals), noun: plural(p.crystals, dict.crystalsNoun), price: store.price(p.sku) })}
              className={p.sku === sku ? 'offer-pick offer-pick-on' : 'offer-pick'}
              onClick={() => {
                if (p.sku === sku) return;
                sfxUi();
                setSku(p.sku);
              }}
            >
              {/* Four in a row leave no room for the crystal glyph: the cyan value says «crystals». */}
              <Coin value={formatCount(p.crystals)} caption={store.price(p.sku)} tone="cy" />
            </button>
          ))}
        </div>
      }
      onClose={onClose}
      onResult={onResult}
      primaryRef={primaryRef}
    />
  );
}
