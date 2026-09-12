import { useEffect } from 'react';
import { dict } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { Button, Screen, useSwipeBack } from '@/shared/ui';
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
        <div className="shop-head-row">
          <h1 className="page-title">{dict.shop}</h1>
          <WalletBadge link={false} />
        </div>
      </header>
      <ShopGrid />
      <div className="shop-foot">
        <Button variant="ghost" onClick={() => navigate('menu')}>
          {dict.back}
        </Button>
      </div>
    </Screen>
  );
}
