import { store, type BuyOutcome, type Sku } from '@/shared/lib/iap';
import { buyTrack, recordCrystals, trackPrice, useProgress } from '@/entities/progress';
import { CATALOG, type TrackMeta } from '@/entities/track';
import { markMusicPackBought, musicPack, packOwned, packValue } from '@/entities/offers';
import { grantOffer, type Granted } from './grant';

/** The music pack as sold: derived once from the catalog with the shop's price formula. */
export const MUSIC_PACK_TRACKS: readonly TrackMeta[] = musicPack(CATALOG, trackPrice);
export const MUSIC_PACK_IDS: readonly string[] = MUSIC_PACK_TRACKS.map((t) => t.id);
/** What the pack costs in crystals, bought track by track (the popup's value coin). */
export const MUSIC_PACK_VALUE = packValue(MUSIC_PACK_TRACKS, trackPrice);

/** Every pack track is owned — nothing left to sell. */
export function useMusicPackOwned(): boolean {
  return useProgress((s) => packOwned(MUSIC_PACK_TRACKS, s.purchased));
}

export interface BuyOfferResult {
  outcome: BuyOutcome;
  /** What was granted; empty unless `outcome === 'ok'`. */
  granted: Granted;
}

/**
 * Pay through the store and, on success, hand the goods over through the progress store: crystal
 * packs credit the wallet (`recordCrystals`), the music pack marks its tracks purchased the way
 * `buyTrack` does, skipping the ones owned already.
 */
export async function buyOffer(sku: Sku): Promise<BuyOfferResult> {
  const outcome = await store.buy(sku);
  if (outcome !== 'ok') return { outcome, granted: { crystals: 0, tracks: [] } };
  const granted = grantOffer(sku, {
    addCrystals: recordCrystals,
    unlockTrack: (id) => buyTrack(id, 0).ok,
    packIds: MUSIC_PACK_IDS,
    markMusicBought: markMusicPackBought,
  });
  return { outcome, granted };
}
