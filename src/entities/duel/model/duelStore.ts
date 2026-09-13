import { createStore, useStore } from '@/shared/lib/store/createStore';
import type { Duel } from '@/shared/api/duels';

interface DuelState {
  /** The duel opened from a link, waiting on the challenge screen. */
  pending: Duel | null;
  /** The duel the current run answers (set when the challenge is accepted, cleared with the next session). */
  active: Duel | null;
}

const duelStore = createStore<DuelState>({ pending: null, active: null });

export function setPendingDuel(duel: Duel | null): void {
  duelStore.set({ pending: duel });
}

/** The challenge was accepted: this run answers the duel. */
export function acceptDuel(duel: Duel): void {
  duelStore.set({ pending: null, active: duel });
}

export function clearActiveDuel(): void {
  duelStore.set({ active: null });
}

export function usePendingDuel(): Duel | null {
  return useStore(duelStore, (s) => s.pending);
}

export function useActiveDuel(): Duel | null {
  return useStore(duelStore, (s) => s.active);
}
