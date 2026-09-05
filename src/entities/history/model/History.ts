import type { Rank } from '@/shared/types/result';

/** One finished run (passed, failed or flagged) of a track. */
export interface Attempt {
  /** ISO timestamp of the finish. */
  at: string;
  score: number;
  accuracy: number;
  rank: Rank;
  maxCombo: number;
  failed: boolean;
}

export interface HistoryV1 {
  version: 1;
  /** Attempts per track, newest first, capped at HISTORY_CAP. */
  tracks: Record<string, Attempt[]>;
}

export type HistoryData = HistoryV1;

export const HISTORY_VERSION = 1;
export const HISTORY_CAP = 50;
/** Attempts taken into account by the accuracy trend. */
export const TREND_WINDOW = 5;

const RANKS: readonly Rank[] = ['SS', 'S', 'A', 'B', 'C', 'D'];

export function emptyHistory(): HistoryData {
  return { version: 1, tracks: {} };
}

function isAttempt(x: unknown): x is Attempt {
  if (!x || typeof x !== 'object') return false;
  const a = x as Record<string, unknown>;
  return (
    typeof a.at === 'string' &&
    typeof a.score === 'number' &&
    Number.isFinite(a.score) &&
    typeof a.accuracy === 'number' &&
    Number.isFinite(a.accuracy) &&
    typeof a.rank === 'string' &&
    RANKS.includes(a.rank as Rank) &&
    typeof a.maxCombo === 'number' &&
    typeof a.failed === 'boolean'
  );
}

/** Parse a stored blob; unknown versions or garbage yield an empty history, bad rows are dropped. */
export function parseHistory(raw: unknown): HistoryData {
  if (!raw || typeof raw !== 'object') return emptyHistory();
  const data = raw as Record<string, unknown>;
  if (data.version !== HISTORY_VERSION || !data.tracks || typeof data.tracks !== 'object') return emptyHistory();
  const tracks: Record<string, Attempt[]> = {};
  for (const [id, list] of Object.entries(data.tracks as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const rows = list.filter(isAttempt).slice(0, HISTORY_CAP);
    if (rows.length) tracks[id] = rows;
  }
  return { version: 1, tracks };
}

/** Prepend an attempt (newest first) and drop everything beyond the cap. Pure. */
export function addAttempt(data: HistoryData, trackId: string, attempt: Attempt): HistoryData {
  const prev = data.tracks[trackId] ?? [];
  const next = [attempt, ...prev].slice(0, HISTORY_CAP);
  return { version: 1, tracks: { ...data.tracks, [trackId]: next } };
}

const NONE: readonly Attempt[] = [];

/** Attempts of a track, newest first. */
export function attemptsOf(data: HistoryData, trackId: string): readonly Attempt[] {
  return data.tracks[trackId] ?? NONE;
}

export function playsOf(data: HistoryData, trackId: string): number {
  return attemptsOf(data, trackId).length;
}

/** Best non-failed attempt by score (ties → higher accuracy, then earlier). */
export function bestOf(data: HistoryData, trackId: string): Attempt | undefined {
  let best: Attempt | undefined;
  const list = attemptsOf(data, trackId);
  // Iterate oldest → newest so that on a full tie the earlier attempt wins.
  for (let i = list.length - 1; i >= 0; i--) {
    const a = list[i];
    if (a.failed) continue;
    if (!best || a.score > best.score || (a.score === best.score && a.accuracy > best.accuracy)) best = a;
  }
  return best;
}

/**
 * Accuracy trend: newest accuracy minus the accuracy at the start of the last-N window
 * (N = TREND_WINDOW). 0 with fewer than two attempts. Positive = improving.
 */
export function trendOf(data: HistoryData, trackId: string): number {
  const list = attemptsOf(data, trackId);
  if (list.length < 2) return 0;
  const window = list.slice(0, TREND_WINDOW);
  return window[0].accuracy - window[window.length - 1].accuracy;
}

export type TrendDirection = 'up' | 'down' | 'flat';

/** Direction of a trend delta with a small dead zone so ±0.1 % does not flip the arrow. */
export function trendDirection(delta: number, deadZone = 0.005): TrendDirection {
  if (delta > deadZone) return 'up';
  if (delta < -deadZone) return 'down';
  return 'flat';
}
