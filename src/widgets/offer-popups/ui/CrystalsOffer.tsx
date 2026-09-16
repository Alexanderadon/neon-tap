import { useState, type RefObject } from 'react';
import { dict, fmt } from '@/shared/i18n';
import { store } from '@/shared/lib/iap';
import { formatCount } from '@/shared/lib/format';
import { sfxUi } from '@/shared/lib/audio';
import { Coin, CrystalIcon, Tag } from '@/shared/ui';
import { CRYSTAL_PACKS, type CrystalPackSku } from '@/entities/offers';
import type { BuyOfferResult } from '@/features/buy-offer';
import { OfferSheet } from './OfferSheet';
import { HeroPiles } from './heroes';

interface Props {
  onClose: () => void;
  onResult: (r: BuyOfferResult) => void;
  primaryRef: RefObject<HTMLDivElement>;
}

const crystalIcon = (
  <span className="offer-cy">
    <CrystalIcon size={20} />
  </span>
);

/**
 * The regular crystals popup («КРИСТАЛЛЫ»): three piles, the three packs as pressable coins
 * (500 · 1 500 · 4 000 with their prices), the chosen pack's bonus on the benefit line, its price
 * on the button. Never automatic — the wallet's «+» and the shop's not-enough state open it.
 */
export function CrystalsOffer({ onClose, onResult, primaryRef }: Props) {
  const [sku, setSku] = useState<CrystalPackSku>('crystals-m');
  const pack = CRYSTAL_PACKS.find((p) => p.sku === sku) ?? CRYSTAL_PACKS[0];
  const benefit = pack.bonusPercent > 0 ? fmt(dict.offerCrystalsBonus, { n: pack.bonusPercent }) : dict.offerCrystalsBase;
  return (
    <OfferSheet
      kind="crystals"
      sku={sku}
      hero={sku}
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
              className={p.sku === sku ? 'offer-pick offer-pick-on' : 'offer-pick'}
              onClick={() => {
                if (p.sku === sku) return;
                sfxUi();
                setSku(p.sku);
              }}
            >
              <Coin icon={crystalIcon} value={formatCount(p.crystals)} caption={store.price(p.sku)} tone="cy" />
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
