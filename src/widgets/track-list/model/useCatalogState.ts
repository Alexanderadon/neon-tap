import { useMemo } from 'react';
import { unlockAllActive } from '@/shared/config/devFlags';
import { now } from '@/shared/lib/time';
import { DROPS, PREMIUM_IDS, TRACK_IDS, type DropState } from '@/entities/track';
import { isPassActive } from '@/entities/pass';
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
import { dropLocks } from './dropLocks';

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
  /** Unlock info by track id (road and premium tracks only — weekly tracks are in `drops`). */
  unlocks: ReadonlyMap<string, UnlockInfo>;
  /** The lock of every weekly track by id, as of the page load's clock. */
  drops: ReadonlyMap<string, DropState>;
  /** NEON PASS is active: weekly tracks open a week early and are granted. */
  pass: boolean;
  /** The clock the weekly locks were computed with (ms). */
  nowMs: number;
}

/** Everything the hero and the reel share: the save, the star total, the daily track, unlocks. */
export function useCatalogState(): CatalogState {
  const save = useProgress((s) => s);
  return useMemo(() => buildCatalogState(save), [save]);
}

/** The catalog state of a save — the hook's value, also for code outside React (the boot loader). */
export function buildCatalogState(save: SaveData, nowMs: number = now(), pass: boolean = isPassActive()): CatalogState {
  const trackStars = totalStars(save, TRACK_IDS);
  const bonus = bonusStars(save);
  const stars = trackStars + bonus;
  const today = localDateString();
  const dailyId = dailyTrackId(today, TRACK_IDS);
  const unlockAll = unlockAllActive();
  const list = unlockStates(TRACK_IDS, { stars, dailyId, unlockAll, purchased: save.purchased, premium: PREMIUM_IDS });
  const unlocks = new Map(list.map((u) => [u.id, u]));
  return {
    save,
    stars,
    trackStars,
    bonus,
    maxTrackStars: TRACK_IDS.length * 3,
    dailyId,
    dailyDone: isDailyDone(save.daily, today),
    streak: save.daily.streak,
    unlocks,
    drops: dropLocks(DROPS, { nowMs, purchased: save.purchased, pass, unlockAll }),
    pass,
    nowMs,
  };
}

export interface LockState {
  locked: boolean;
  /** Stars still required (progression tracks); 0 when open, premium or weekly. */
  need: number;
  /** Premium tracks never open by stars — only by purchase in the shop. */
  premium: boolean;
  /** Crystal price (locked premium and weekly tracks). */
  price: number;
  /** A weekly track: its full state (soon, this week, open early with PASS, ad window). */
  drop?: DropState;
}

/** How a track is locked: weekly tracks first (their own map), then the road; custom / unknown ids are always open. */
export function lockFor(state: CatalogState, id: string, stars: number): LockState {
  const drop = state.drops.get(id);
  if (drop) return { locked: !drop.open, need: 0, premium: false, price: drop.open ? 0 : drop.price, drop };
  const u = state.unlocks.get(id);
  if (!u || u.unlocked) return { locked: false, need: 0, premium: false, price: 0 };
  return { locked: true, need: u.premium ? 0 : u.need, premium: u.premium, price: trackPrice(stars, u.premium) };
}
