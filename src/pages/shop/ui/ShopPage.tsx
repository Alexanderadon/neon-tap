import { useEffect } from 'react';
import { dict } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { Screen, useSwipeBack } from '@/shared/ui';
import { ShopGrid } from '@/widgets/shop-grid';
import { WalletBadge } from '@/widgets/wallet-badge';
import '../../page.css';
import './shop.css';

/** Crystal shop: balance + how to earn on top, one card per track on sale, back to the menu. */
const toMenu = () => navigate('menu');

export function ShopPage() {
  useSwipeBack(toMenu);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') navigate('menu');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Screen className="shop">
      <header className="shop-head">
        <button type="button" className="shop-back" onClick={toMenu} aria-label={dict.back}>
          <BackIcon />
        </button>
        <h1 className="page-title shop-title">{dict.shop}</h1>
        <WalletBadge link={false} />
      </header>
      <ShopGrid />
    </Screen>
  );
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}
