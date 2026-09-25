/** Everything the app sells: four crystal packs (NEON PASS has no SKU until payments exist). */
export type Sku = 'crystals-s' | 'crystals-m' | 'crystals-l' | 'crystals-xl';

export const SKUS: readonly Sku[] = ['crystals-s', 'crystals-m', 'crystals-l', 'crystals-xl'];

export function isSku(v: unknown): v is Sku {
  return typeof v === 'string' && (SKUS as readonly string[]).includes(v);
}

/** How a purchase ended: the goods are granted only on `'ok'`. */
export type BuyOutcome = 'ok' | 'cancel' | 'failed';

/**
 * In-app purchase provider seam. Real billing (Google Play / App Store through Capacitor) comes
 * later; until then `StubStore` "processes" a payment on a timer in development. Callers only ever
 * see this interface — prices are display strings because the store, not the app, formats them.
 */
export interface Store {
  /** Whether purchases can be offered right now (billing connected, products loaded). */
  available(): boolean;
  /** The localized price of a product as the store shows it («249 ₽»). */
  price(sku: Sku): string;
  /** Start the purchase flow; resolves when it ends. Never rejects — errors come back as `'failed'`. */
  buy(sku: Sku): Promise<BuyOutcome>;
}
