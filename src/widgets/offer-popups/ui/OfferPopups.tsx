import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { dict } from '@/shared/i18n';
import { store } from '@/shared/lib/iap';
import { sfxGem } from '@/shared/lib/audio';
import { centreOf } from '@/shared/lib/viewport';
import { CrystalFlight, CrystalIcon, Icon, type FlightPath } from '@/shared/ui';
import { progressStore } from '@/entities/progress';
import type { OfferKind } from '@/entities/offers';
import type { BuyOfferResult } from '@/features/buy-offer';
import { CrystalsOffer } from './CrystalsOffer';
import './offer-popups.css';

/** A wallet counter tick for the top bar: from → to after `delay` seconds (TopBar's CounterTick shape). */
export interface OfferWalletTick {
  from: number;
  to: number;
  delay?: number;
}

interface Props {
  /** Kept for the menu's call site: nothing opens by itself any more (no automatic popups, no timed deals). */
  auto?: boolean;
  /** An explicit ask (the wallet's «+», the shop's not-enough sheet); acknowledged through `onRequestHandled`. */
  request: OfferKind | null;
  onRequestHandled: () => void;
  /** The wallet's crystal chip — bought crystals fly into it. */
  crystalsRef?: RefObject<HTMLElement>;
  /** The wallet ticks after the flight. */
  onWalletTick?: (tick: OfferWalletTick) => void;
}

const TOAST_MS = 2600;
/** The wallet ticks when the last crystal lands (mockup: .8 s). */
const TICK_DELAY = 0.8;

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The host of the crystal packs sheet: it opens only when asked (the wallet's «+», the shop's
 * not-enough sheet) — never by itself, with no timers and no «only today» — plus the success toast
 * and the crystals' flight into the wallet chip. Nothing is offered when the store is unavailable.
 */
export function OfferPopups({ request, onRequestHandled, crystalsRef, onWalletTick }: Props) {
  const [active, setActive] = useState<OfferKind | null>(null);
  const [toast, setToast] = useState<{ text: string; icon: 'crystal' | 'cross' } | null>(null);
  const [flight, setFlight] = useState<FlightPath | null>(null);
  const primaryRef = useRef<HTMLDivElement>(null);
  const available = store.available();

  // Explicit asks.
  useEffect(() => {
    if (request === null) return;
    if (available) setActive(request);
    onRequestHandled();
  }, [request, available, onRequestHandled]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  const close = useCallback(() => setActive(null), []);
  const endFlight = useCallback(() => setFlight(null), []);

  const onResult = useCallback(
    (r: BuyOfferResult) => {
      if (r.outcome === 'cancel') {
        setActive(null);
        return;
      }
      if (r.outcome === 'failed') {
        setToast({ text: dict.offerFailed, icon: 'cross' });
        return;
      }
      const origin = centreOf(primaryRef.current?.querySelector('.primary-lead'));
      setActive(null);
      if (r.granted.crystals <= 0) return;
      sfxGem(true);
      setToast({ text: dict.offerCrystalsGot, icon: 'crystal' });
      const target = centreOf(crystalsRef?.current);
      const fly = origin !== null && target !== null && !reducedMotion();
      if (fly) setFlight({ from: origin, to: target });
      const to = progressStore.get().crystals;
      onWalletTick?.({ from: to - r.granted.crystals, to, delay: fly ? TICK_DELAY : 0 });
    },
    [crystalsRef, onWalletTick],
  );

  return (
    <>
      {active === 'crystals' && <CrystalsOffer onClose={close} onResult={onResult} primaryRef={primaryRef} />}
      {toast && (
        <div className={toast.icon === 'cross' ? 'offer-toast offer-toast-bad' : 'offer-toast'} role="status">
          {toast.icon === 'crystal' ? <CrystalIcon size={20} /> : <Icon name="cross" size={20} />}
          {toast.text}
        </div>
      )}
      {flight && <CrystalFlight path={flight} onDone={endFlight} />}
    </>
  );
}
