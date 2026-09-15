import type { Sku } from '@/shared/lib/iap';
import { MUSIC_PACK_SKU, crystalsFor } from '@/entities/offers';

export interface GrantDeps {
  /** Credit crystals to the wallet (`recordCrystals`). */
  addCrystals(amount: number): void;
  /** Mark a track owned at price 0 (`buyTrack(id, 0)`); false when it is owned already. */
  unlockTrack(id: string): boolean;
  /** Ids of the music pack. */
  packIds: readonly string[];
  markMusicBought(): void;
}

export interface Granted {
  crystals: number;
  /** Tracks unlocked by this grant (already-owned ones are skipped — the pack is idempotent). */
  tracks: string[];
}

/** Hand over what a paid sku buys. Pure apart from the injected store calls. */
export function grantOffer(sku: Sku, deps: GrantDeps): Granted {
  if (sku === MUSIC_PACK_SKU) {
    const tracks = deps.packIds.filter((id) => deps.unlockTrack(id));
    deps.markMusicBought();
    return { crystals: 0, tracks };
  }
  const crystals = crystalsFor(sku);
  if (crystals > 0) deps.addCrystals(crystals);
  return { crystals, tracks: [] };
}
