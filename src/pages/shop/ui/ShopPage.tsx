import { useCallback, useEffect, useRef, useState } from 'react';
import { navigate } from '@/shared/lib/router';
import { sfxUi } from '@/shared/lib/audio';
import { packsVisible } from '@/shared/lib/iap';
import { Screen } from '@/shared/ui';
import { CoverScene } from '@/entities/track';
import type { OfferKind } from '@/entities/offers';
import { TopBar, type CounterTick } from '@/widgets/top-bar';
import { ShopGrid, type SceneTrack, type WalletTick } from '@/widgets/shop-grid';
import { OfferPopups } from '@/widgets/offer-popups';
import { releaseSongBuffer } from '@/features/play-custom';
import './shop.css';

const toMenu = () => {
  sfxUi();
  navigate('menu');
};
const toRecords = () => {
  sfxUi();
  navigate('menu', { view: 'records' });
};
const toProfile = () => {
  sfxUi();
  navigate('menu', { view: 'profile' });
};
/** A tap on an owned card opens the deck on that track. */
const toTrack = (id: string) => {
  sfxUi();
  navigate('menu', { track: id });
};

/** How long a wallet tick stays on the top bar before it reads the live wallet again (flight + tick + bump). */
const TICK_HOLD_MS = 1400;

/**
 * The shop screen: the scene tinted by the focused card's cover, the top bar identical to every
 * other screen, and the shop widget (sub-header, cards, purchase sheet, ad, bottom action zone).
 * The wallet chip ticks when the widget says so; the crystals fly into it from the widget's layer.
 * The crystal packs ride on top — only when asked for: the not-enough sheet and the wallet's «+».
 */
export function ShopPage() {
  const [scene, setScene] = useState<SceneTrack | null>(null);
  const [tick, setTick] = useState<CounterTick | null>(null);
  const [offer, setOffer] = useState<OfferKind | null>(null);
  const crystalsRef = useRef<HTMLElement>(null);
  const onWalletTick = useCallback((t: WalletTick) => setTick(t), []);
  const offerHandled = useCallback(() => setOffer(null), []);
  const topUp = useCallback(() => {
    sfxUi();
    setOffer('crystals');
  }, []);
  const selling = packsVisible();
  // The last own song's decoded buffer is not needed in the shop (its previews decode catalog songs): let it go.
  useEffect(() => {
    releaseSongBuffer();
  }, []);
  useEffect(() => {
    if (!tick) return;
    const id = window.setTimeout(() => setTick(null), (tick.delay ?? 0) * 1000 + TICK_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [tick]);

  return (
    <Screen frame className="shop">
      <CoverScene id={scene?.id} genre={scene?.genre} />
      <TopBar crystals={tick ?? undefined} crystalsRef={crystalsRef} onTopUp={selling ? topUp : undefined} />
      <ShopGrid
        crystalsRef={crystalsRef}
        onSceneTrack={setScene}
        onWalletTick={onWalletTick}
        onBack={toMenu}
        onRecords={toRecords}
        onProfile={toProfile}
        onTrack={toTrack}
        onTopUp={selling ? topUp : undefined}
      />
      <OfferPopups request={offer} onRequestHandled={offerHandled} crystalsRef={crystalsRef} onWalletTick={onWalletTick} />
    </Screen>
  );
}
