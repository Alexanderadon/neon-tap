import { ads } from '@/shared/lib/ads';
import { buyTrack, type PurchaseFailure } from '@/entities/progress';
import { watchAdForTrack, type WatchAdResult } from './unlockByAd';

/** Pay crystals for a track (the store deducts the price and appends the id to `purchased[]`). */
export function buyTrackWithCrystals(trackId: string, price: number): { ok: boolean; reason?: PurchaseFailure } {
  return buyTrack(trackId, price);
}

/** Unlock a track for free — the same `purchased[]` entry a purchase writes, price 0. */
export function unlockTrackByAd(trackId: string): boolean {
  return buyTrack(trackId, 0).ok;
}

/**
 * Give tracks for free — NEON PASS writes every weekly track in view to `purchased[]` (price 0), so
 * they stay after the pass ends. Owned ids are skipped; returns the ids granted by this call.
 */
export function grantTracks(trackIds: readonly string[]): string[] {
  return trackIds.filter((id) => buyTrack(id, 0).ok);
}

/** Show the rewarded ad for a track and unlock it when the ad plays to the end. */
export function watchAdAndUnlock(trackId: string): Promise<WatchAdResult> {
  return watchAdForTrack(trackId, { ads, unlock: unlockTrackByAd });
}
