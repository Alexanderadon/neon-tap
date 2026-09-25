import type { SaveData } from './SaveData';
import type { UnlockInfo } from './unlocks';

/** Track price in crystals: `PRICE_BASE + PRICE_PER_STAR · ★`, premium tracks × `PREMIUM_MULTIPLIER`. */
export const PRICE_BASE = 40;
export const PRICE_PER_STAR = 15;
export const PREMIUM_MULTIPLIER = 2.5;

export function trackPrice(stars: number, premium = false): number {
  const s = Number.isFinite(stars) ? Math.max(0, stars) : 0;
  return Math.round((PRICE_BASE + PRICE_PER_STAR * s) * (premium ? PREMIUM_MULTIPLIER : 1));
}

/**
 * What the shop lists: premium tracks (always shop-only), tracks the player bought, and tracks
 * still closed by stars. Tracks open by stars alone have nothing to sell.
 */
export function isForSale(info: UnlockInfo, stars: number): boolean {
  return info.premium || info.purchased || stars < info.need;
}

export function isPurchased(save: SaveData, trackId: string): boolean {
  return save.purchased.includes(trackId);
}

export function canAfford(save: SaveData, price: number): boolean {
  return save.crystals >= price;
}

/** Credit crystals the player earned — runs, bonuses, badges (non-positive amounts are ignored); they count towards the lifetime total. */
export function addCrystals(save: SaveData, amount: number): SaveData {
  const n = Math.floor(amount);
  if (!(n > 0)) return save;
  return { ...save, crystals: save.crystals + n, lifetimeCrystals: save.lifetimeCrystals + n };
}

/** Credit crystals bought for money: the balance grows, the lifetime total (the «Кристаллы» badges) does not. */
export function creditPaidCrystals(save: SaveData, amount: number): SaveData {
  const n = Math.floor(amount);
  if (!(n > 0)) return save;
  return { ...save, crystals: save.crystals + n };
}

export type PurchaseFailure = 'owned' | 'poor';

/**
 * Buy a track: deducts `price` and marks the id purchased. Fails without touching the save when
 * the track is already owned or the balance is short. Idempotent per id. Only a purchase that
 * cost crystals counts towards the «Покупки» badges — an unlock for an ad or NEON PASS is free.
 */
export function purchaseTrack(save: SaveData, trackId: string, price: number): { save: SaveData; ok: boolean; reason?: PurchaseFailure } {
  if (isPurchased(save, trackId)) return { save, ok: false, reason: 'owned' };
  const cost = Math.max(0, Math.round(price));
  if (!canAfford(save, cost)) return { save, ok: false, reason: 'poor' };
  const counters = cost > 0 ? { ...save.counters, bought: save.counters.bought + 1 } : save.counters;
  return { save: { ...save, crystals: save.crystals - cost, purchased: [...save.purchased, trackId], counters }, ok: true };
}
