import { createStore, useStore } from '@/shared/lib/store/createStore';
import { addAttempt, emptyHistory, parseHistory, type Attempt, type HistoryData } from './History';

export const HISTORY_KEY = 'neon-tap:history';

function load(): HistoryData {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? parseHistory(JSON.parse(raw)) : emptyHistory();
  } catch {
    return emptyHistory();
  }
}

export const historyStore = createStore<HistoryData>(typeof localStorage === 'undefined' ? emptyHistory() : load());

historyStore.subscribe(() => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(historyStore.get()));
  } catch {
    /* storage unavailable */
  }
});

/** Append a finished run to the track's history. Returns the attempt number (1-based, newest). */
export function recordAttempt(trackId: string, attempt: Attempt): number {
  historyStore.set(addAttempt(historyStore.get(), trackId, attempt));
  return historyStore.get().tracks[trackId]?.length ?? 0;
}

export function resetHistory(): void {
  historyStore.set(emptyHistory());
}

export function useHistory<R>(selector: (h: HistoryData) => R): R {
  return useStore(historyStore, selector);
}
