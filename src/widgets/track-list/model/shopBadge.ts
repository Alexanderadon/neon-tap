import { CATALOG } from '@/entities/track';
import { isForSale, trackPrice, type UnlockInfo } from '@/entities/progress';
import type { CatalogState } from './useCatalogState';

/** Star-locked tracks on sale at a time — mirrors the shop's window (the next few on the road). */
export const LOCKED_ON_SALE = 6;

/** What the shop would list right now: premium tracks and the next locked ones, minus what is already owned. */
export function forSaleNow(state: Pick<CatalogState, 'unlocks' | 'stars'>): { id: string; price: number; info: UnlockInfo }[] {
  const out: { id: string; price: number; info: UnlockInfo }[] = [];
  let locked = 0;
  for (const track of CATALOG) {
    const info = state.unlocks.get(track.id);
    if (!info || info.purchased || !isForSale(info, state.stars)) continue;
    if (!info.premium && locked++ >= LOCKED_ON_SALE) continue;
    out.push({ id: track.id, info, price: trackPrice(track.stars, info.premium) });
  }
  return out;
}

/** The shop badge on the main screen: how many tracks the crystals can buy right now. */
export function affordableCount(state: Pick<CatalogState, 'unlocks' | 'stars' | 'save'>): number {
  const crystals = state.save.crystals;
  return forSaleNow(state).filter((t) => t.price <= crystals).length;
}
