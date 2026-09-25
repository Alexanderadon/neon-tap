import { useMemo } from 'react';
import { unlockAllActive } from '@/shared/config/devFlags';
import { CATALOG, PREMIUM_IDS, TRACK_IDS } from '@/entities/track';
import {
  bonusStars,
  dailyTrackId,
  isDailyDone,
  localDateString,
  totalStars,
  trackPrice,
  unlockStates,
  useProgress,
  type SaveData,
  type UnlockInfo,
} from '@/entities/progress';

export interface CatalogState {
  save: SaveData;
  /** Stars from tracks + bonuses (the number the unlock thresholds compare against). */
  stars: number;
  trackStars: number;
  bonus: number;
  maxTrackStars: number;
  dailyId: string | null;
  dailyDone: boolean;
  streak: number;
  /** Unlock info by track id (catalog tracks only). */
  unlocks: ReadonlyMap<string, UnlockInfo>;
}

/** Everything the hero and the reel share: the save, the star total, the daily track, unlocks. */
export function useCatalogState(): CatalogState {
  const save = useProgress((s) => s);
  return useMemo(() => buildCatalogState(save), [save]);
}

/** The catalog state of a save — the hook's value, also for code outside React (the boot loader). */
export function buildCatalogState(save: SaveData): CatalogState {
  const trackStars = totalStars(save, TRACK_IDS);
  const bonus = bonusStars(save);
  const stars = trackStars + bonus;
  const today = localDateString();
  const dailyId = dailyTrackId(today, TRACK_IDS);
  const list = unlockStates(TRACK_IDS, { stars, dailyId, unlockAll: unlockAllActive(), purchased: save.purchased, premium: PREMIUM_IDS });
  const unlocks = new Map(list.map((u) => [u.id, u]));
  return {
    save,
    stars,
    trackStars,
    bonus,
    maxTrackStars: CATALOG.length * 3,
    dailyId,
    dailyDone: isDailyDone(save.daily, today),
    streak: save.daily.streak,
    unlocks,
  };
}

export interface LockState {
  locked: boolean;
  /** Stars still required (progression tracks); 0 when open or premium. */
  need: number;
  /** Premium tracks never open by stars — only by purchase in the shop. */
  premium: boolean;
  /** Crystal price (for locked premium tracks). */
  price: number;
}

/** How a track is locked; custom / unknown ids are always open. */
export function lockFor(state: CatalogState, id: string, stars: number): LockState {
  const u = state.unlocks.get(id);
  if (!u || u.unlocked) return { locked: false, need: 0, premium: false, price: 0 };
  return { locked: true, need: u.premium ? 0 : u.need, premium: u.premium, price: trackPrice(stars, u.premium) };
}
