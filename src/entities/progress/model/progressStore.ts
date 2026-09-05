import { createStore, useStore } from '@/shared/lib/store/createStore';
import type { SpellKind } from '@/shared/types/chart';
import { addRun, addSpell, emptySave, mergeResult, migrate, type BestResult, type SaveData } from './SaveData';
import { completeDaily, localDateString } from './daily';
import { claimGoals, type Goal } from './goals';
import { addCrystals, purchaseTrack, type PurchaseFailure } from './shop';

const KEY = 'neon-tap:save';

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : emptySave();
  } catch {
    return emptySave();
  }
}

// Goals completed by an older save (migration back-fills counters) are claimed on load, so the
// panel never shows a full bar without its tick.
export const progressStore = createStore<SaveData>(claimGoals(typeof localStorage === 'undefined' ? emptySave() : load()).save);

progressStore.subscribe(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(progressStore.get()));
  } catch {
    /* storage unavailable */
  }
});

export function recordResult(trackId: string, result: BestResult): boolean {
  const { save, newRecord } = mergeResult(progressStore.get(), trackId, result);
  progressStore.set(save);
  return newRecord;
}

/** A spell was caught mid-run (any song). */
export function recordSpell(kind: SpellKind): void {
  progressStore.set(addSpell(progressStore.get(), kind));
}

/** Lifetime counters after a finished, non-failed run. */
export function recordRun(run: { maxCombo: number; trackStars: number }): void {
  progressStore.set(addRun(progressStore.get(), run));
}

/** Claim today's daily bonus star; false when already claimed today. */
export function completeDailyToday(date: string = localDateString()): boolean {
  const { save, granted } = completeDaily(progressStore.get(), date);
  if (granted) progressStore.set(save);
  return granted;
}

/** Grant rewards for newly completed goals; returns them for the result screen. */
export function claimCompletedGoals(): Goal[] {
  const { save, claimed } = claimGoals(progressStore.get());
  if (claimed.length) progressStore.set(save);
  return claimed;
}

/** Credit crystals collected in a finished, non-failed run. */
export function recordCrystals(amount: number): void {
  if (amount > 0) progressStore.set(addCrystals(progressStore.get(), amount));
}

/** Buy a track in the shop; false with the reason when it is owned already or the balance is short. */
export function buyTrack(trackId: string, price: number): { ok: boolean; reason?: PurchaseFailure } {
  const { save, ok, reason } = purchaseTrack(progressStore.get(), trackId, price);
  if (ok) progressStore.set(save);
  return { ok, reason };
}

export function resetProgress(): void {
  progressStore.set(emptySave());
}

export function useProgress<R>(selector: (s: SaveData) => R): R {
  return useStore(progressStore, selector);
}
