import type { Sku } from '@/shared/lib/iap';
import { crystalsFor } from '@/entities/offers';

export interface GrantDeps {
  /** Credit bought crystals to the wallet (`addPaidCrystals`: the balance, not the lifetime total). */
  addCrystals(amount: number): void;
}

export interface Granted {
  crystals: number;
}

/** Hand over what a paid sku buys. Pure apart from the injected store call. */
export function grantOffer(sku: Sku, deps: GrantDeps): Granted {
  const crystals = crystalsFor(sku);
  if (crystals > 0) deps.addCrystals(crystals);
  return { crystals };
}
