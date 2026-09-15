import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { dict } from '@/shared/i18n';
import { store } from '@/shared/lib/iap';
import { sfxGem, sfxMilestone } from '@/shared/lib/audio';
import { centreOf } from '@/shared/lib/viewport';
import { CrystalFlight, CrystalIcon, Icon, type FlightPath } from '@/shared/ui';
import { firstLaunchStep, getSettings, isWelcomeSkipped } from '@/entities/settings';
import { progressStore, useProgress } from '@/entities/progress';
import {
  ensureOffersAnchor,
  limitedShownThisSession,
  limitedWindow,
  markLimitedShownThisSession,
  markMusicOfferShown,
  musicOfferDue,
  offersStore,
  packOwned,
  type OfferKind,
} from '@/entities/offers';
import { MUSIC_PACK_TRACKS, type BuyOfferResult } from '@/features/buy-offer';
import { pickAutoOffer } from '../model/autoOffer';
import { useLimitedWindow } from '../model/useLimitedWindow';
import { CrystalsOffer } from './CrystalsOffer';
import { LimitedOffer } from './LimitedOffer';
import { MusicOffer } from './MusicOffer';
import './offer-popups.css';

/** A wallet counter tick for the top bar: from → to after `delay` seconds (TopBar's CounterTick shape). */
export interface OfferWalletTick {
  from: number;
  to: number;
  delay?: number;
}

interface Props {
  /** The menu: the schedule opens the 48-hour deal / the music pack by itself, one per mount. */
  auto?: boolean;
  /** An explicit ask (the wallet's «+», the shop's not-enough, the header tag); acknowledged through `onRequestHandled`. */
  request: OfferKind | null;
  onRequestHandled: () => void;
  /** The wallet's crystal chip — bought crystals fly into it. */
  crystalsRef?: RefObject<HTMLElement>;
  /** The wallet ticks after the flight. */
  onWalletTick?: (tick: OfferWalletTick) => void;
}

const TOAST_MS = 2600;
/** The menu settles first (frame-enter 0.25 s), then the popup rises. */
const AUTO_DELAY_MS = 600;
/** The wallet ticks when the last crystal lands (mockup: .8 s). */
const TICK_DELAY = 0.8;

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The host of the offer popups: one sheet at a time, the success toast and the crystals' flight
 * into the wallet chip. Nothing is offered when the store is unavailable, and the automatic
 * popups never rise over the first-launch flow (name → calibration → tutorial).
 */
export function OfferPopups({ auto = false, request, onRequestHandled, crystalsRef, onWalletTick }: Props) {
  const [active, setActive] = useState<OfferKind | null>(null);
  const [toast, setToast] = useState<{ text: string; icon: 'crystal' | 'note' | 'cross' } | null>(null);
  const [flight, setFlight] = useState<FlightPath | null>(null);
  const primaryRef = useRef<HTMLDivElement>(null);
  const window48 = useLimitedWindow();
  const musicOwned = useProgress((s) => packOwned(MUSIC_PACK_TRACKS, s.purchased));
  const available = store.available();

  // Explicit asks.
  useEffect(() => {
    if (request === null) return;
    if (available) {
      // The deal can be asked for only while its window is open.
      const anchor = ensureOffersAnchor();
      if (request !== 'limited' || limitedWindow(anchor, Date.now()).active) setActive(request);
    }
    onRequestHandled();
  }, [request, available, onRequestHandled]);

  // The schedule (menu only): one popup per mount, marked as shown when it actually rises.
  useEffect(() => {
    if (!auto) return;
    const now = Date.now();
    const anchor = ensureOffersAnchor(now);
    const offers = offersStore.get();
    const progress = progressStore.get();
    const pick = pickAutoOffer({
      available: store.available(),
      firstLaunchPending: firstLaunchStep(getSettings(), isWelcomeSkipped()) !== null,
      limitedActive: limitedWindow(anchor, now).active,
      limitedShown: limitedShownThisSession(),
      musicDue: musicOfferDue(
        { runs: progress.counters.tracksPlayed, shownAt: offers.musicShownAt, bought: offers.musicBought || packOwned(MUSIC_PACK_TRACKS, progress.purchased) },
        now,
      ),
    });
    if (!pick) return;
    const t = window.setTimeout(() => {
      if (pick === 'limited') markLimitedShownThisSession();
      else markMusicOfferShown(Date.now());
      setActive(pick);
    }, AUTO_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [auto]);

  // The deal closes itself when its window ends.
  useEffect(() => {
    if (active === 'limited' && window48 && !window48.active) setActive(null);
  }, [active, window48]);

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
      if (r.granted.crystals > 0) {
        sfxGem(true);
        setToast({ text: dict.offerCrystalsGot, icon: 'crystal' });
        const target = centreOf(crystalsRef?.current);
        const fly = origin !== null && target !== null && !reducedMotion();
        if (fly) setFlight({ from: origin, to: target });
        const to = progressStore.get().crystals;
        onWalletTick?.({ from: to - r.granted.crystals, to, delay: fly ? TICK_DELAY : 0 });
      } else {
        sfxMilestone();
        setToast({ text: dict.offerTracksGot, icon: 'note' });
      }
    },
    [crystalsRef, onWalletTick],
  );

  let sheet = null;
  if (active === 'crystals') sheet = <CrystalsOffer onClose={close} onResult={onResult} primaryRef={primaryRef} />;
  else if (active === 'limited' && window48?.active)
    sheet = <LimitedOffer remainingMs={window48.remainingMs} onClose={close} onResult={onResult} primaryRef={primaryRef} />;
  else if (active === 'music' && !musicOwned) sheet = <MusicOffer onClose={close} onResult={onResult} primaryRef={primaryRef} />;

  return (
    <>
      {sheet}
      {toast && (
        <div className={toast.icon === 'cross' ? 'offer-toast offer-toast-bad' : 'offer-toast'} role="status">
          {toast.icon === 'crystal' ? <CrystalIcon size={20} /> : <Icon name={toast.icon} size={20} />}
          {toast.text}
        </div>
      )}
      {flight && <CrystalFlight path={flight} onDone={endFlight} />}
    </>
  );
}
