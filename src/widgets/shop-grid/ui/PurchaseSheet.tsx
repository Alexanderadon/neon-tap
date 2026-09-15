import { useEffect, useId, type ReactNode, type RefObject } from 'react';
import { dict, fmt, plural } from '@/shared/i18n';
import { Coin, CrystalIcon, Difficulty, Disc, Icon, ObjButton, PrimaryAction, Star, Tag, Thumb } from '@/shared/ui';
import { TrackCover, type TrackMeta } from '@/entities/track';
import type { PurchasePaths, PurchasePlan } from '@/features/buy-track';
import type { ShopItem } from '../model/shopItems';
import { adSecondsText } from '../lib/adText';

interface Props {
  item: ShopItem;
  plan: PurchasePlan;
  paths: PurchasePaths;
  /** The daily track — the «ЗАРАБОТАТЬ» button's cover and name when the player is short and there is no ad. */
  daily: TrackMeta | null;
  onBuy: () => void;
  onAd: () => void;
  onEarn: () => void;
  onClose: () => void;
  /** The primary button's slot — the crystals fly from it into the wallet chip. */
  primaryRef: RefObject<HTMLDivElement>;
}

/**
 * The purchase sheet (mockup screens 3 / 6 / 9 / 10): a bottom sheet 375 × 544 over a plain veil,
 * one 335 column inside — title · cover 96 · name · flame + condition · three coins («цена · у тебя ·
 * останется» or «… · не хватает») · [hint] · [ad row] · «Отмена» · the primary button on the same
 * line as the screen's own. One cyan button = one way in.
 */
export function PurchaseSheet({ item, plan, paths, daily, onBuy, onAd, onEarn, onClose, primaryRef }: Props) {
  const { track } = item;
  const titleId = useId();
  const starId = `${titleId.replace(/:/g, '')}-star`;
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    primaryRef.current?.querySelector('button')?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [primaryRef]);

  const short = !plan.affordable;
  const crystalIcon = (
    <span className="shop-cy">
      <CrystalIcon size={20} />
    </span>
  );
  let primary: ReactNode;
  if (paths.primary === 'buy') {
    primary = (
      <PrimaryAction
        lead={
          <Disc>
            <CrystalIcon size={24} />
          </Disc>
        }
        label={dict.shopBuy}
        sub={fmt(dict.shopBuyFor, { n: plan.price, noun: plural(plan.price, dict.crystalsNoun) })}
        onClick={onBuy}
      />
    );
  } else if (paths.primary === 'ad') {
    primary = (
      <PrimaryAction
        lead={
          <Disc>
            <Icon name="ad" size={24} />
          </Disc>
        }
        label={dict.shopAdFreeShort}
        sub={adSecondsText(dict.shopAdCaption)}
        onClick={onAd}
      />
    );
  } else {
    primary = (
      <PrimaryAction
        lead={
          daily ? (
            <Thumb>
              <TrackCover id={daily.id} genre={daily.genre} title={daily.title} />
            </Thumb>
          ) : (
            <Disc>
              <Icon name="play" size={24} />
            </Disc>
          )
        }
        label={dict.shopEarn}
        sub={daily ? fmt(dict.shopDailyLabel, { title: daily.title }) : dict.shopEarnHint}
        onClick={onEarn}
      />
    );
  }

  return (
    <div className="sheet-root">
      <div className="sheet-dim" onPointerDown={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="sheet-col">
          <h2 id={titleId} className="sheet-h1">
            {short ? dict.shopNotEnoughTitle : dict.shopConfirmTitle}
          </h2>
          <div className="sheet-cover">
            <TrackCover id={track.id} genre={track.genre} title={track.title} />
          </div>
          <h3 className="sheet-h2">{track.title}</h3>
          <div className="sheet-meta">
            <Difficulty stars={track.stars} />
            {item.kind === 'premium' ? (
              <Tag>{dict.shopPremium}</Tag>
            ) : (
              <Tag variant="dark" icon={<Star id={starId} on />}>
                {fmt(dict.shopStarsMore, { n: item.starsShort })}
              </Tag>
            )}
          </div>
          <div className={short ? 'sheet-loot sheet-loot-tight' : 'sheet-loot'}>
            <Coin icon={crystalIcon} value={plan.price} caption={dict.shopPriceLabel} tone="cy" animate delay={0.3} />
            <Coin icon={crystalIcon} value={plan.have} caption={dict.shopYouHave} tone="cy" animate delay={0.4} />
            {short ? (
              <Coin icon={crystalIcon} value={plan.short} caption={dict.shopNotEnoughShort} tone="mag" animate delay={0.5} />
            ) : (
              <Coin icon={crystalIcon} value={plan.remaining} caption={dict.shopWillRemain} tone="cy" animate delay={0.5} />
            )}
          </div>
          {short && <div className="sheet-hint">{paths.primary === 'ad' ? fmt(dict.shopNotEnoughLine, { n: plan.short }) : dict.shopEarnHintLong}</div>}
          {paths.adRow && (
            <ObjButton
              construction
              className="shop-adrow"
              icon={<Icon name="ad" size={20} />}
              label={dict.shopWatchAd}
              sub={adSecondsText(dict.shopAdFree)}
              end={<Icon name="arrow" size={20} />}
              onClick={onAd}
            />
          )}
          <div className={short ? 'sheet-actions sheet-actions-tight' : 'sheet-actions'}>
            <ObjButton icon={<Icon name="cross" size={20} />} label={dict.shopConfirmNo} onClick={onClose} />
            <div className="sheet-primary" ref={primaryRef}>
              {primary}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
