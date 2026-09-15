/** The numbers the purchase sheet shows: «цена · у тебя · останется» or «цена · у тебя · не хватает». */
export interface PurchasePlan {
  price: number;
  have: number;
  /** Balance after the purchase (0 when short). */
  remaining: number;
  /** Crystals missing (0 when affordable). */
  short: number;
  affordable: boolean;
}

export function purchasePlan(price: number, have: number): PurchasePlan {
  const p = Math.max(0, Math.round(Number.isFinite(price) ? price : 0));
  const h = Math.max(0, Math.floor(Number.isFinite(have) ? have : 0));
  const short = Math.max(0, p - h);
  return { price: p, have: h, remaining: Math.max(0, h - p), short, affordable: short === 0 };
}

/** What the sheet's primary button does: pay crystals, watch an ad, or go earn (play the daily track). */
export type PurchasePath = 'buy' | 'ad' | 'earn';

export interface PurchasePaths {
  primary: PurchasePath;
  /** The dark «Смотреть рекламу» row between the coins and «Отмена» (only next to a cyan «КУПИТЬ»). */
  adRow: boolean;
}

/**
 * Screens 3 / 6 / 9 / 10 of the shop mockup: with enough crystals the cyan button buys and the ad is
 * the second, dark way; when short, the ad takes the cyan button and there is no crystal button
 * at all; without an ad provider the short state sends the player to earn.
 */
export function purchasePaths(plan: Pick<PurchasePlan, 'affordable'>, adsAvailable: boolean): PurchasePaths {
  if (plan.affordable) return { primary: 'buy', adRow: adsAvailable };
  return { primary: adsAvailable ? 'ad' : 'earn', adRow: false };
}
