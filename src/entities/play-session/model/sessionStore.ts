import { createStore, useStore } from '@/shared/lib/store/createStore';
import type { ChartFile } from '@/shared/types/chart';
import type { PlayResult } from '@/shared/types/result';

export type ChartSource = 'catalog' | 'custom';

export interface PlaySession {
  chart: ChartFile | null;
  /** Decoded audio for custom songs (built-in tracks are streamed by URL). */
  audioBuffer: AudioBuffer | null;
  source: ChartSource;
  result: PlayResult | null;
  /** Filled by the save feature so the result screen can celebrate. */
  resultMeta: { newRecord: boolean; starsBefore: number; starsAfter: number } | null;
}

export const sessionStore = createStore<PlaySession>({
  chart: null,
  audioBuffer: null,
  source: 'catalog',
  result: null,
  resultMeta: null,
});

export function startSession(chart: ChartFile, source: ChartSource, audioBuffer: AudioBuffer | null = null): void {
  sessionStore.set({ chart, source, audioBuffer, result: null, resultMeta: null });
}

export function setSessionResult(result: PlayResult, meta: PlaySession['resultMeta']): void {
  sessionStore.set({ result, resultMeta: meta });
}

export function useSession<R>(selector: (s: PlaySession) => R): R {
  return useStore(sessionStore, selector);
}
