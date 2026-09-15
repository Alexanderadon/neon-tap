import type { RefObject } from 'react';
import { dict, fmt } from '@/shared/i18n';
import { formatCount } from '@/shared/lib/format';
import { Coin, CrystalIcon, Icon, Tag } from '@/shared/ui';
import { LIMITED_DEAL, countdownText, crystalPack } from '@/entities/offers';
import type { BuyOfferResult } from '@/features/buy-offer';
import { OfferSheet } from './OfferSheet';
import { HeroChest } from './heroes';

interface Props {
  /** Milliseconds until the window closes (the live countdown). */
  remainingMs: number;
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
 * The 48-hour deal («ТОЛЬКО 48 ЧАСОВ» with the countdown beside it): the open chest, «в 2 раза
 * больше», the coins «3 000 · сейчас», «1 500 · обычно», «×2», the middle pack's price on the button.
 */
export function LimitedOffer({ remainingMs, onClose, onResult, primaryRef }: Props) {
  const usual = crystalPack(LIMITED_DEAL.pricedAs)?.crystals ?? 0;
  return (
    <OfferSheet
      kind="limited"
      sku={LIMITED_DEAL.sku}
      title={dict.offerLimitedTag}
      placeholder={<HeroChest />}
      tags={
        <>
          <Tag shape="left" icon={<Icon name="hourglass" size={16} />}>
            {dict.offerLimitedTag}
          </Tag>
          <Tag shape="right" variant="dark">
            {countdownText(remainingMs)}
          </Tag>
        </>
      }
      benefit={dict.offerLimitedBenefit}
      coins={
        <>
          <Coin icon={crystalIcon} value={formatCount(LIMITED_DEAL.crystals)} caption={dict.offerNow} tone="cy" animate delay={0.3} />
          <Coin icon={crystalIcon} value={formatCount(usual)} caption={dict.offerUsually} animate delay={0.4} />
          <Coin value={dict.offerTimes2} caption={dict.crystalsNoun[2]} tone="gd" animate delay={0.5} />
        </>
      }
      note={fmt(dict.offerLeft, { t: countdownText(remainingMs) })}
      onClose={onClose}
      onResult={onResult}
      primaryRef={primaryRef}
    />
  );
}
