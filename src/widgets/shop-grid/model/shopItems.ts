import { dropState, type DropState, type TrackMeta } from '@/entities/track';
import { isForSale, trackPrice, unlockStates, type UnlockInfo } from '@/entities/progress';

export interface ShopItem {
  track: TrackMeta;
  info: UnlockInfo;
  /** Crystals to buy it. */
  price: number;
  /** Stars still missing to open it on the road (0 for premium, weekly and owned tracks). */
  starsShort: number;
  /** Card state: locked by stars (buy early), premium (shop-only), a weekly track out now, owned. */
  kind: 'locked' | 'premium' | 'drop' | 'owned';
  /** A weekly track: its lock — the «Новинка недели» / «Новинка» tag and the ad window. */
  drop?: DropState;
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
 * What the crystals can buy on the road, in the order the mockup reads: first the next
 * LOCKED_ON_SALE tracks still closed by stars (an early unlock — «★ ЕЩЁ N» is the alternative), then
 * the premium ones («ПРЕМИУМ»), and the tracks already bought at the very bottom («КУПЛЕНО»). Tracks
 * open by stars alone are not listed — nothing to sell. Weekly tracks are not the road: they are
 * left out here (their thresholds would shift every position) and listed by `dropShopItems`.
 */
export function shopItems({ catalog, stars, premium, purchased }: Args): ShopItem[] {
  const road = catalog.filter((t) => t.drop !== true);
  const states = unlockStates(
    road.map((t) => t.id),
    { stars, premium, purchased },
  );
  const locked: ShopItem[] = [];
  const prem: ShopItem[] = [];
  const owned: ShopItem[] = [];
  road.forEach((track, i) => {
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

interface DropArgs {
  /** The weekly tracks in the deck. */
  drops: readonly TrackMeta[];
  nowMs: number;
  purchased: readonly string[];
  pass: boolean;
  unlockAll: boolean;
}

/**
 * The first shelf «Новинки»: weekly tracks out and not owned, newest first, 150 crystals each (and
 * the ad in their first 14 days); the owned ones for the bottom. One not out yet is not for sale,
 * and one open without a purchase (PASS, unlock-all) has nothing to sell.
 */
export function dropShopItems({ drops, nowMs, purchased, pass, unlockAll }: DropArgs): { sale: ShopItem[]; owned: ShopItem[] } {
  const sale: ShopItem[] = [];
  const owned: ShopItem[] = [];
  for (const track of [...drops].reverse()) {
    if (track.drop !== true) continue;
    const bought = purchased.includes(track.id);
    const drop = dropState(track, { nowMs, owned: bought, pass, unlockAll });
    const info: UnlockInfo = { id: track.id, unlocked: drop.open, need: 0, premium: false, purchased: bought };
    if (bought) owned.push({ track, info, price: drop.price, starsShort: 0, kind: 'owned', drop });
    else if (!drop.open && !drop.soon) sale.push({ track, info, price: drop.price, starsShort: 0, kind: 'drop', drop });
  }
  return { sale, owned };
}

/** The whole list: the «Новинки» shelf, the road and premium for sale, then everything owned (weekly tracks last). */
export function shopList(road: readonly ShopItem[], drops: { sale: readonly ShopItem[]; owned: readonly ShopItem[] }): ShopItem[] {
  return [...drops.sale, ...road.filter((i) => i.kind !== 'owned'), ...road.filter((i) => i.kind === 'owned'), ...drops.owned];
}

/**
 * Keep the order the list opened with: a card bought during the visit stays where the finger is
 * (under the toast) and sinks to the bottom only on the next visit. Ids not in `order` go last.
 */
export function stableOrder(items: readonly ShopItem[], order: readonly string[]): ShopItem[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...items].sort((a, b) => (rank.get(a.track.id) ?? order.length) - (rank.get(b.track.id) ?? order.length));
}
