import type { Difficulty } from '@/shared/config/constants';
import { createStore, useStore } from '@/shared/lib/store/createStore';
import { EMPTY_SAVE, mergeResult, migrate, type BestResult, type SaveData } from './SaveData';

const KEY = 'neon-tap:save';

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : { ...EMPTY_SAVE, tracks: {} };
  } catch {
    return { ...EMPTY_SAVE, tracks: {} };
  }
}

export const progressStore = createStore<SaveData>(typeof localStorage === 'undefined' ? { ...EMPTY_SAVE, tracks: {} } : load());

progressStore.subscribe(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(progressStore.get()));
  } catch {
    /* storage unavailable */
  }
});

export function recordResult(trackId: string, difficulty: Difficulty, result: BestResult): boolean {
  const { save, newRecord } = mergeResult(progressStore.get(), trackId, difficulty, result);
  progressStore.set(save);
  return newRecord;
}

export function resetProgress(): void {
  progressStore.set({ ...EMPTY_SAVE, tracks: {} });
}

export function useProgress<R>(selector: (s: SaveData) => R): R {
  return useStore(progressStore, selector);
}
