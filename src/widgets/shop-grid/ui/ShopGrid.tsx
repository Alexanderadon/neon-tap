import { useCallback, useEffect, useRef, useState } from 'react';
import { dict, fmt, plural } from '@/shared/i18n';
import { audioEngine, sfxGem } from '@/shared/lib/audio';
import { themeFor } from '@/shared/lib/render';
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
/** A preview: this many seconds, starting a third of the way in (past the intro). */
const PREVIEW_SEC = 5;
const PREVIEW_AT = 1 / 3;

/** Star-locked tracks on sale at a time: the next few on the road, not the whole catalog. */
const LOCKED_ON_SALE = 6;

/**
 * What the crystals can buy: premium tracks, the next LOCKED_ON_SALE tracks still closed by stars
 * (an early unlock) and the ones already bought (shown as owned, at the bottom). Tracks open by
 * stars alone are not listed — nothing to sell.
 */
export function ShopGrid() {
  const save = useProgress((s) => s);
  const stars = grandTotalStars(save, TRACK_IDS);
  const states = unlockStates(TRACK_IDS, { stars, premium: PREMIUM_IDS, purchased: save.purchased });
  const items: Item[] = [];
  let lockedShown = 0;
  CATALOG.forEach((track, i) => {
    const info = states[i];
    if (!isForSale(info, stars)) return;
    if (!info.premium && !info.purchased && lockedShown++ >= LOCKED_ON_SALE) return;
    items.push({ track, info, price: trackPrice(track.stars, track.premium === true) });
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

  const [previewing, setPreviewing] = useState<string | null>(null);
  const previewToken = useRef(0);
  const stopPreview = useCallback(() => {
    previewToken.current++;
    audioEngine.stop();
    setPreviewing(null);
  }, []);
  useEffect(() => stopPreview, [stopPreview]);
  /** Tap the cover: five seconds of the song from a third in; tap again (or another cover) to stop. */
  const togglePreview = useCallback(
    async (track: TrackMeta) => {
      if (previewing === track.id) {
        stopPreview();
        return;
      }
      const token = ++previewToken.current;
      setPreviewing(track.id);
      try {
        await audioEngine.ensureContext();
        const buffer = await audioEngine.loadUrl(`${import.meta.env.BASE_URL}music/${track.id}.mp3`);
        if (token !== previewToken.current) return;
        audioEngine.preview(buffer, buffer.duration * PREVIEW_AT, PREVIEW_SEC, () => {
          if (token === previewToken.current) setPreviewing(null);
        });
      } catch {
        if (token === previewToken.current) setPreviewing(null);
      }
    },
    [previewing, stopPreview],
  );
  return (
    <div className="shopgrid">
      {items.length === 0 && <div className="shopgrid-empty">{dict.shopEmpty}</div>}
      {items.map((it, i) => (
        <ShopCard
          key={it.track.id}
          item={it}
          index={i}
          balance={save.crystals}
          onBuy={() => setConfirm(it)}
          previewing={previewing === it.track.id}
          onPreview={() => togglePreview(it.track)}
        />
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
  /** This card's five-second listen is playing. */
  previewing: boolean;
  onPreview: () => void;
}

function ShopCard({ item, index, balance, onBuy, previewing, onPreview }: CardProps) {
  const { track, info, price } = item;
  const owned = info.purchased;
  const tone = track.premium ? '#ff2bd6' : themeFor(track.genre, track.id).accent;
  const premium = info.premium;
  const short = Math.max(0, price - balance);
  const canBuy = !owned && short === 0;
  const cls = ['shopcard', owned && 'shopcard-owned', premium && 'shopcard-premium'].filter(Boolean).join(' ');
  return (
    <article className={cls} style={{ ['--tone' as string]: tone, ['--i' as string]: index }}>
      <button
        type="button"
        className={`shopcard-listen${previewing ? ' is-playing' : ''}`}
        onClick={onPreview}
        aria-label={`${previewing ? dict.shopPreviewStop : dict.shopPreview} · ${track.title}`}
        aria-pressed={previewing}
      >
        <TrackCover id={track.id} genre={track.genre} title={track.title} className="shopcard-cover" />
        <span className="shopcard-listen-icon" aria-hidden="true">
          {previewing ? (
            <span className="shopcard-eq">
              <i />
              <i />
              <i />
            </span>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.5 2.5v11l9-5.5z" />
            </svg>
          )}
        </span>
      </button>
      <div className="shopcard-body">
        <div className="shopcard-title">{track.title}</div>
        <div className="shopcard-genre">
          {premium && <span className="shopcard-tag">{dict.shopPremium}</span>}
          <span className="shopcard-price">★ {track.stars}</span>
          {!owned && (
            <span className={`shopcard-price${short > 0 ? ' is-short' : ''}`}>
              {' · '}
              <CrystalIcon size={11} /> {price}
            </span>
          )}
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
            {dict.shopBuy}
          </Button>
        )}
      </div>
    </article>
  );
}
