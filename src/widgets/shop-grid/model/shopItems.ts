import type { TrackMeta } from '@/entities/track';
import { isForSale, trackPrice, unlockStates, type UnlockInfo } from '@/entities/progress';

export interface ShopItem {
  track: TrackMeta;
  info: UnlockInfo;
  /** Crystals to buy it. */
  price: number;
  /** Stars still missing to open it on the road (0 for premium and owned tracks). */
  starsShort: number;
  /** Card state: locked by stars (buy early), premium (shop-only), owned. */
  kind: 'locked' | 'premium' | 'owned';
}

/** Star-locked tracks on sale at a time: the next few on the road, not the whole catalog. */
export const LOCKED_ON_SALE = 6;

interface Args {
  catalog: readonly TrackMeta[];
  stars: number;
  premium: readonly string[];
  purchased: readonly string[];
}

/**
 * What the crystals can buy, in the order the mockup reads: first the next LOCKED_ON_SALE tracks
 * still closed by stars (an early unlock — «★ ЕЩЁ N» is the alternative), then the premium ones
 * («ПРЕМИУМ»), and the tracks already bought at the very bottom («КУПЛЕНО»). Tracks open by stars
 * alone are not listed — nothing to sell.
 */
export function shopItems({ catalog, stars, premium, purchased }: Args): ShopItem[] {
  const states = unlockStates(
    catalog.map((t) => t.id),
    { stars, premium, purchased },
  );
  const locked: ShopItem[] = [];
  const prem: ShopItem[] = [];
  const owned: ShopItem[] = [];
  catalog.forEach((track, i) => {
    const info = states[i];
    if (!isForSale(info, stars)) return;
    const price = trackPrice(track.stars, track.premium === true);
    if (info.purchased) {
      owned.push({ track, info, price, starsShort: 0, kind: 'owned' });
    } else if (info.premium) {
      prem.push({ track, info, price, starsShort: 0, kind: 'premium' });
    } else if (locked.length < LOCKED_ON_SALE) {
      locked.push({ track, info, price, starsShort: Math.max(0, info.need - stars), kind: 'locked' });
    }
  });
  return [...locked, ...prem, ...owned];
}

/**
 * Keep the order the list opened with: a card bought during the visit stays where the finger is
 * (under the toast) and sinks to the bottom only on the next visit. Ids not in `order` go last.
 */
export function stableOrder(items: readonly ShopItem[], order: readonly string[]): ShopItem[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...items].sort((a, b) => (rank.get(a.track.id) ?? order.length) - (rank.get(b.track.id) ?? order.length));
}
