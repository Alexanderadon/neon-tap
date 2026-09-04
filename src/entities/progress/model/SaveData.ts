import type { Difficulty } from '@/shared/config/constants';
import type { Rank } from '@/shared/types/result';

export interface BestResult {
  score: number;
  accuracy: number;
  rank: Rank;
  maxCombo: number;
  fullCombo: boolean;
  playedAt: string;
}

export type TrackProgress = Partial<Record<Difficulty, BestResult>>;

export interface SaveDataV1 {
  version: 1;
  tracks: Record<string, TrackProgress>;
  plays: number;
}

export type SaveData = SaveDataV1;

export const CURRENT_VERSION = 1;

export const EMPTY_SAVE: SaveData = { version: 1, tracks: {}, plays: 0 };

/**
 * Schema migrations, applied in order. Each entry upgrades from `from` to `from + 1`.
 * v0 = pre-versioned blobs (we never shipped one, but the pipeline is here for when v2 lands).
 */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
  0: (data) => ({ version: 1, tracks: (data.tracks as Record<string, unknown>) ?? {}, plays: 0 }),
};

export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_SAVE, tracks: {} };
  let data = raw as Record<string, unknown>;
  let version = typeof data.version === 'number' ? data.version : 0;
  while (version < CURRENT_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return { ...EMPTY_SAVE, tracks: {} };
    data = step(data);
    version++;
  }
  return {
    version: 1,
    tracks: (data.tracks as Record<string, TrackProgress>) ?? {},
    plays: typeof data.plays === 'number' ? data.plays : 0,
  };
}

const RANK_ORDER: Rank[] = ['D', 'C', 'B', 'A', 'S', 'SS'];

export function rankIndex(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

/** Stars earned on a track: 1 for a pass (rank ≥ C), +1 for A, +1 for S — best over all difficulties. */
export function starsForTrack(progress: TrackProgress | undefined): number {
  if (!progress) return 0;
  let best = -1;
  for (const r of Object.values(progress)) if (r) best = Math.max(best, rankIndex(r.rank));
  if (best < rankIndex('C')) return 0;
  if (best < rankIndex('A')) return 1;
  if (best < rankIndex('S')) return 2;
  return 3;
}

export function totalStars(save: SaveData, trackIds?: readonly string[]): number {
  const ids = trackIds ?? Object.keys(save.tracks);
  let sum = 0;
  for (const id of ids) sum += starsForTrack(save.tracks[id]);
  return sum;
}

/** Merge a new result; returns whether it beat the stored best score. */
export function mergeResult(save: SaveData, trackId: string, difficulty: Difficulty, result: BestResult): { save: SaveData; newRecord: boolean } {
  const prev = save.tracks[trackId]?.[difficulty];
  const newRecord = !prev || result.score > prev.score;
  const merged: BestResult = newRecord
    ? { ...result, fullCombo: result.fullCombo || (prev?.fullCombo ?? false) }
    : { ...prev, fullCombo: prev.fullCombo || result.fullCombo, rank: RANK_ORDER[Math.max(rankIndex(prev.rank), rankIndex(result.rank))] };
  return {
    save: {
      ...save,
      plays: save.plays + 1,
      tracks: { ...save.tracks, [trackId]: { ...save.tracks[trackId], [difficulty]: merged } },
    },
    newRecord,
  };
}
