import { useCallback, useEffect, useState } from 'react';
import { dict, fmt, plural } from '@/shared/i18n';
import { sfxGem } from '@/shared/lib/audio';
import { Button, CrystalIcon, Modal } from '@/shared/ui';
import { CATALOG, PREMIUM_IDS, TRACK_IDS, TrackCover, type TrackMeta } from '@/entities/track';
import { buyTrack, grandTotalStars, isForSale, trackPrice, unlockStates, useProgress, type UnlockInfo } from '@/entities/progress';
import './shop-grid.css';

interface Item {
  track: TrackMeta;
  info: UnlockInfo;
  price: number;
}

const TOAST_MS = 2600;

/**
 * Everything the crystals can buy: premium tracks, tracks still closed by stars and the ones
 * already bought (shown as owned). Tracks open by stars alone are not listed — nothing to sell.
 */
export function ShopGrid() {
  const save = useProgress((s) => s);
  const stars = grandTotalStars(save, TRACK_IDS);
  const states = unlockStates(TRACK_IDS, { stars, premium: PREMIUM_IDS, purchased: save.purchased });
  const items: Item[] = [];
  CATALOG.forEach((track, i) => {
    const info = states[i];
    if (isForSale(info, stars)) items.push({ track, info, price: trackPrice(track.stars, track.premium === true) });
  });
  // Owned tracks sink to the bottom; the rest keep catalog order (easiest first).
  items.sort((a, b) => Number(a.info.purchased) - Number(b.info.purchased));

  const [confirm, setConfirm] = useState<Item | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const closeConfirm = useCallback(() => setConfirm(null), []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  const buy = () => {
    if (!confirm) return;
    const { ok } = buyTrack(confirm.track.id, confirm.price);
    if (ok) {
      sfxGem(true);
      setToast(fmt(dict.shopBoughtToast, { title: confirm.track.title }));
    }
    setConfirm(null);
  };

  return (
    <div className="shopgrid">
      {items.length === 0 && <div className="shopgrid-empty">{dict.shopEmpty}</div>}
      {items.map((it, i) => (
        <ShopCard key={it.track.id} item={it} index={i} balance={save.crystals} onBuy={() => setConfirm(it)} />
      ))}
      <Modal open={confirm !== null} title={dict.shopConfirmTitle} onClose={closeConfirm} closeLabel={dict.shopConfirmNo} variant="dialog">
        {confirm && (
          <div className="shop-confirm">
            <p className="shop-confirm-text">
              {fmt(dict.shopConfirmText, {
                title: confirm.track.title,
                price: confirm.price,
                noun: plural(confirm.price, dict.crystalsNoun),
                left: save.crystals - confirm.price,
              })}
            </p>
            <div className="shop-confirm-actions">
              <Button onClick={buy} autoFocus>
                {dict.shopConfirmYes}
              </Button>
              <Button variant="ghost" onClick={closeConfirm}>
                {dict.shopConfirmNo}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {toast && (
        <div className="shopgrid-toast" role="status">
          <CrystalIcon size={14} /> {toast}
        </div>
      )}
    </div>
  );
}

interface CardProps {
  item: Item;
  index: number;
  balance: number;
  onBuy: () => void;
}

function ShopCard({ item, index, balance, onBuy }: CardProps) {
  const { track, info, price } = item;
  const owned = info.purchased;
  const premium = info.premium;
  const short = Math.max(0, price - balance);
  const canBuy = !owned && short === 0;
  const cls = ['shopcard', owned && 'shopcard-owned', premium && 'shopcard-premium'].filter(Boolean).join(' ');
  return (
    <article className={cls} style={{ ['--tone' as string]: premium ? '#ff2bd6' : '#7df9ff', ['--i' as string]: index }}>
      <TrackCover id={track.id} genre={track.genre} title={track.title} className="shopcard-cover" />
      <div className="shopcard-body">
        <div className="shopcard-title">{track.title}</div>
        <div className="shopcard-genre">
          {premium && <span className="shopcard-tag">{dict.shopPremium}</span>}★ {track.stars}
        </div>
      </div>
      <div className="shopcard-side">
        {owned ? (
          <span className="shopcard-bought">{dict.shopBought}</span>
        ) : (
          <Button
            size="md"
            className={`shopcard-buy${short > 0 ? ' is-short' : ''}`}
            disabled={!canBuy}
            onClick={onBuy}
            aria-label={`${dict.shopBuy} · ${price} ${plural(price, dict.crystalsNoun)}${short > 0 ? ` · ${fmt(dict.shopNotEnough, { n: short })}` : ''}`}
          >
            {dict.shopBuy} · <CrystalIcon size={13} /> <span className="shopcard-buy-price">{price}</span>
          </Button>
        )}
      </div>
    </article>
  );
}
