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
  /**
   * Crystals credited to the wallet by this run, all of them: the run's own after the daily allowance,
   * the daily track, first clears and the calendar mark (badges are counted by `goalsCompleted`);
   * absent when nothing was credited or the run failed.
   */
  crystals?: number;
  /**
   * Why the run paid fewer crystals than it collected: the day's allowance is full ('day' — from now on
   * every fifth crystal), today's own-song crystals are all collected ('custom'), the song is shorter than
   * a minute ('short').
   */
  capped?: 'day' | 'custom' | 'short';
  /** The login calendar's mark this run made (the day's first passed run): its place in the loop (1–7) and its crystals. */
  calendar?: { day: number; reward: number };
  /** Crystals for the first three stars and / or the first crown on this track (once each). */
  firstClear?: number;
  /** Crystals for today's daily track (with `dailyBonus`). */
  dailyCrystals?: number;
  /** The standing record score before this run (catalog tracks); `null` when the track had none — the exact «БЫЛО N». */
  bestBefore?: number | null;
}

export interface PlaySession {
  chart: ChartFile | null;
  /** Decoded audio for custom songs (built-in tracks are streamed by URL). */
  audioBuffer: AudioBuffer | null;
  source: ChartSource;
  result: PlayResult | null;
  /** Filled by the save feature so the result screen can celebrate. */
  resultMeta: ResultMeta | null;
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
