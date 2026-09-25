import { store, type BuyOutcome, type Sku } from '@/shared/lib/iap';
import { addPaidCrystals } from '@/entities/progress';
import { grantOffer, type Granted } from './grant';

export interface BuyOfferResult {
  outcome: BuyOutcome;
  /** What was granted; nothing unless `outcome === 'ok'`. */
  granted: Granted;
}

/**
 * Pay through the store and, on success, credit the pack's crystals to the wallet. Bought crystals
 * raise the balance only — the «Кристаллы» badges count what the player earned.
 */
export async function buyOffer(sku: Sku): Promise<BuyOfferResult> {
  const outcome = await store.buy(sku);
  if (outcome !== 'ok') return { outcome, granted: { crystals: 0 } };
  return { outcome, granted: grantOffer(sku, { addCrystals: addPaidCrystals }) };
}
