import { useMemo } from 'react';
import { unlockAllActive } from '@/shared/config/devFlags';
import { CATALOG, TRACK_IDS } from '@/entities/track';
import {
  bonusStars,
  dailyTrackId,
  isDailyDone,
  localDateString,
  totalStars,
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
  return useMemo(() => {
    const trackStars = totalStars(save, TRACK_IDS);
    const bonus = bonusStars(save);
    const stars = trackStars + bonus;
    const today = localDateString();
    const dailyId = dailyTrackId(today, TRACK_IDS);
    const list = unlockStates(TRACK_IDS, { stars, dailyId, unlockAll: unlockAllActive() });
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
  }, [save]);
}

/** Stars still required for a track; 0 = playable (custom / unknown ids are always open). */
export function needFor(state: CatalogState, id: string): number {
  const u = state.unlocks.get(id);
  return u && !u.unlocked ? u.need : 0;
}
