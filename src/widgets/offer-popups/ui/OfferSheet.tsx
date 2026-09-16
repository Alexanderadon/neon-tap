import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { dict, fmt } from '@/shared/i18n';
import { store, stubStore, type Sku } from '@/shared/lib/iap';
import { sfxUi } from '@/shared/lib/audio';
import { Disc, Icon, ObjButton, PrimaryAction, Sheet, useSwipeBack } from '@/shared/ui';
import type { OfferKind } from '@/entities/offers';
import { buyOffer, type BuyOfferResult } from '@/features/buy-offer';
import { OfferHero } from './OfferHero';

interface Props {
  kind: OfferKind;
  sku: Sku;
  /** Illustration name when it differs from the kind — the crystals popup shows the chosen pack. */
  hero?: string;
  /** The procedural placeholder of the hero slot (the image, when present, lies over it). */
  placeholder: ReactNode;
  /** The gold headline tag(s). */
  tags: ReactNode;
  /** One line of benefit («+25 % кристаллов»). */
  benefit: ReactNode;
  /** The coins row (value, price in crystals, …). */
  coins: ReactNode;
  /** An optional line under the coins (the deal's countdown). */
  note?: ReactNode;
  /** Aria name of the dialog (the tags are decorative caps). */
  title: string;
  onClose: () => void;
  /** The purchase ended — ok, cancel or failed; the host shows the toast and the flight. */
  onResult: (r: BuyOfferResult) => void;
  /** The primary button's slot — the crystals fly from it into the wallet chip. */
  primaryRef: RefObject<HTMLDivElement>;
}

/**
 * The one sheet style of every offer: hero 335 × 180 · gold tag · benefit line · coins ·
 * [note] · «Не сейчас» · «КУПИТЬ · 249 ₽». The primary turns into a dark «ОПЛАТА…» while the
 * store processes; «Не сейчас», the veil, Escape and the back swipe close it (and cancel the stub).
 */
export function OfferSheet({ kind, sku, hero, placeholder, tags, benefit, coins, note, title, onClose, onResult, primaryRef }: Props) {
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const close = useCallback(() => {
    // The stub resolves 'cancel'; a real store runs its own sheet and closes itself.
    if (busy && store === stubStore) stubStore.cancel();
    if (busy) return;
    onClose();
  }, [busy, onClose]);
  useSwipeBack(close, true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [close]);

  const buy = useCallback(async () => {
    if (busy) return;
    sfxUi();
    setBusy(true);
    const result = await buyOffer(sku);
    // The grant may unmount this sheet before the promise settles (the music pack becomes owned): the host still hears the result.
    if (mounted.current) setBusy(false);
    onResult(result);
  }, [busy, sku, onResult]);

  return (
    <Sheet titleId={titleId} onClose={close} className="offer-sheet">
      <h2 id={titleId} className="offer-title">
        {title}
      </h2>
      <OfferHero name={hero ?? kind} placeholder={placeholder} />
      <div className="offer-tags">{tags}</div>
      <div className="offer-benefit">{benefit}</div>
      <div className="offer-coins">{coins}</div>
      {note !== undefined && <div className="offer-note">{note}</div>}
      <div className="sheet-actions">
        <ObjButton icon={<Icon name="cross" size={20} />} label={dict.offerNotNow} onClick={close} />
        <div className="sheet-primary" ref={primaryRef}>
          {busy ? (
            <PrimaryAction
              tone="locked"
              lead={
                <Disc>
                  <Icon name="hourglass" size={24} />
                </Disc>
              }
              label={dict.offerProcessing}
              sub={dict.offerProcessingSub}
              icon={null}
              disabled
            />
          ) : (
            <PrimaryAction
              lead={
                <Disc>
                  <Icon name="bag" size={24} />
                </Disc>
              }
              label={fmt(dict.offerBuy, { price: store.price(sku) })}
              beat
              onClick={() => void buy()}
            />
          )}
        </div>
      </div>
    </Sheet>
  );
}
