import { createStore, useStore } from '@/shared/lib/store/createStore';
import type { ChartFile } from '@/shared/types/chart';
import type { PlayResult } from '@/shared/types/result';

export type ChartSource = 'catalog' | 'custom';

/** Celebration metadata produced by the save feature for the result screen. */
export interface ResultMeta {
  newRecord: boolean;
  starsBefore: number;
  starsAfter: number;
  /** Crowns on the track's record before and after this run (endless mode; absent for custom songs). */
  crownsBefore?: number;
  crownsAfter?: number;
  /** This run completed today's daily track for the first time (+1 bonus star). */
  dailyBonus?: boolean;
  /** Goal ids completed (and claimed) by this run. */
  goalsCompleted?: string[];
  /** Crystals credited to the wallet by this run (absent when nothing was collected or the run failed). */
  crystals?: number;
  /** The standing record score before this run (catalog tracks); `null` when the track had none — the exact «БЫЛО N». */
  bestBefore?: number | null;
}

export interface PlaySession {
  chart: ChartFile | null;
  /** Endless mode: after three stars the song keeps looping, faster every loop, a crown per loop. */
  endless: boolean;
  /** Decoded audio for custom songs (built-in tracks are streamed by URL). */
  audioBuffer: AudioBuffer | null;
  source: ChartSource;
  result: PlayResult | null;
  /** Filled by the save feature so the result screen can celebrate. */
  resultMeta: ResultMeta | null;
}

export const sessionStore = createStore<PlaySession>({
  chart: null,
  endless: false,
  audioBuffer: null,
  source: 'catalog',
  result: null,
  resultMeta: null,
});

export function startSession(chart: ChartFile, source: ChartSource, audioBuffer: AudioBuffer | null = null, endless = false): void {
  sessionStore.set({ chart, source, audioBuffer, endless, result: null, resultMeta: null });
}

export function setSessionResult(result: PlayResult, meta: PlaySession['resultMeta']): void {
  sessionStore.set({ result, resultMeta: meta });
}

export function useSession<R>(selector: (s: PlaySession) => R): R {
  return useStore(sessionStore, selector);
}
