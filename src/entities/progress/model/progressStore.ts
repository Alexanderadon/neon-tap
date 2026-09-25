import { createStore, useStore } from '@/shared/lib/store/createStore';
import type { SpellKind } from '@/shared/types/chart';
import { addRun, addSpell, emptySave, mergeResult, migrate, type BestResult, type SaveData } from './SaveData';
import { completeDaily, localDateString } from './daily';
import { claimGoals, type Goal } from './goals';
import { addCrystals, creditPaidCrystals, purchaseTrack, withdrawCrystals, type PurchaseFailure } from './shop';
import { earnRun, type EarningCap, type RunEarningInput } from './earnings';
import { markCalendar, type CalendarMark } from './calendar';

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
export function recordRun(run: Parameters<typeof addRun>[1]): void {
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

/** Credit crystals the player earned outside the daily allowance (the daily track, first clears, the calendar); they count towards the lifetime total. */
export function recordCrystals(amount: number): void {
  if (amount > 0) progressStore.set(addCrystals(progressStore.get(), amount));
}

/**
 * Credit the crystals a finished, non-failed run collected, through the day's allowance
 * (earnings.ts); returns what reached the wallet and why it was less, if it was.
 */
export function recordRunCrystals(input: RunEarningInput): { credited: number; capped: EarningCap | null } {
  const save = progressStore.get();
  const { state, credited, capped } = earnRun(save.earnings, input);
  if (state !== save.earnings || credited > 0) progressStore.set(addCrystals({ ...save, earnings: state }, credited));
  return { credited, capped };
}

/** The login calendar's mark for the first passed run of `date`, with its crystals credited; null when the day is marked already. */
export function recordCalendarMark(date: string = localDateString()): CalendarMark | null {
  const save = progressStore.get();
  const { state, mark } = markCalendar(save.calendar, date);
  if (mark) progressStore.set(addCrystals({ ...save, calendar: state }, mark.reward));
  return mark;
}

/** Crystals bought for money: the balance grows, the lifetime total does not. */
export function addPaidCrystals(amount: number): void {
  if (amount > 0) progressStore.set(creditPaidCrystals(progressStore.get(), amount));
}

/** Pay crystals from the wallet (the second chance); false, and nothing spent, when the balance is short. */
export function spendCrystals(amount: number): boolean {
  const { save, ok } = withdrawCrystals(progressStore.get(), amount);
  if (ok && save !== progressStore.get()) progressStore.set(save);
  return ok;
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
