import { CATALOG, type DropState, type TrackMeta } from '@/entities/track';
import { isForSale, trackPrice, type UnlockInfo } from '@/entities/progress';
import type { CatalogState } from './useCatalogState';

/** Star-locked tracks on sale at a time — mirrors the shop's window (the next few on the road). */
export const LOCKED_ON_SALE = 6;

/**
 * What the shop would list right now: the weekly tracks out and not owned (the first shelf), then
 * premium tracks and the next locked ones, minus what is already owned. A weekly track not out yet
 * is not for sale.
 */
export function forSaleNow(
  state: Pick<CatalogState, 'unlocks' | 'stars'> & Partial<Pick<CatalogState, 'drops'>>,
  catalog: readonly TrackMeta[] = CATALOG,
): { id: string; price: number; info: UnlockInfo; drop?: DropState }[] {
  const drops: { id: string; price: number; info: UnlockInfo; drop: DropState }[] = [];
  const out: { id: string; price: number; info: UnlockInfo }[] = [];
  let locked = 0;
  for (const track of catalog) {
    const drop = state.drops?.get(track.id);
    if (drop) {
      if (!drop.open && !drop.soon) {
        drops.push({ id: track.id, price: drop.price, drop, info: { id: track.id, unlocked: false, need: 0, premium: false, purchased: false } });
      }
      continue;
    }
    const info = state.unlocks.get(track.id);
    if (!info || info.purchased || !isForSale(info, state.stars)) continue;
    if (!info.premium && locked++ >= LOCKED_ON_SALE) continue;
    out.push({ id: track.id, info, price: trackPrice(track.stars, info.premium) });
  }
  return [...drops, ...out];
}

/** The shop badge on the main screen: how many tracks the crystals can buy right now. */
export function affordableCount(state: Pick<CatalogState, 'unlocks' | 'stars' | 'save'> & Partial<Pick<CatalogState, 'drops'>>): number {
  const crystals = state.save.crystals;
  return forSaleNow(state).filter((t) => t.price <= crystals).length;
}
