import { createStore, useStore } from '@/shared/lib/store/createStore';

/**
 * The deck's endless switch: on, the next run of a track with three stars keeps looping past the third
 * level, faster every loop, a crown per loop. A preference for the session, not a save — it resets on a
 * fresh start, so a beginner never lands in endless mode by accident.
 */
export const endlessStore = createStore<{ on: boolean }>({ on: false });

export function useEndless(): boolean {
  return useStore(endlessStore, (s) => s.on);
}

export function toggleEndless(): void {
  endlessStore.set({ on: !endlessStore.get().on });
}
