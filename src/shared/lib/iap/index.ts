/**
 * In-app purchases (GDD «Донат»). The billing provider is not chosen yet: `store` is the stub that
 * resolves `'ok'` after 1.5 s of fake processing and shows placeholder ruble prices — only in
 * development or with `?iap=stub`. On the live site it is unavailable (no crystals are sold, the
 * wallet has no «+»); `?iap=off` hides it in development too.
 *
 * Plugging in a real provider (Capacitor + Google Play / App Store):
 *   1. implement `Store` next to `StubStore` — `available()` = billing connected and the products
 *      loaded, `price(sku)` = the store's localized price string, `buy(sku)` = launch the native
 *      flow and map its result to `'ok' | 'cancel' | 'failed'` (never reject);
 *   2. map the `Sku` ids to the product ids registered in the consoles;
 *   3. swap the instance below. Granting the goods stays in `features/buy-offer` — the provider
 *      never touches the wallet. On the web (no billing) return `available() === false`.
 */
import { StubStore } from './stubStore';
import type { Store } from './types';

export type { BuyOutcome, Sku, Store } from './types';
export { SKUS, isSku } from './types';
export type { StoreClock } from './stubStore';
export { StubStore, STUB_PROCESSING_MS, STUB_PRICES_RUB, rubles, iapOffFlag, iapStubFlag } from './stubStore';

/** The stub instance — the buy button reads `stubStore.processing` / `subscribe()` while it lasts. */
export const stubStore = new StubStore();
/** The one provider the app talks to. */
export const store: Store = stubStore;
