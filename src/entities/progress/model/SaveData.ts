import type { Rank } from '@/shared/types/result';

export interface BestResult {
  score: number;
  accuracy: number;
  rank: Rank;
  maxCombo: number;
  fullCombo: boolean;
  playedAt: string;
}

export interface SaveDataV2 {
  version: 2;
  /** Best result per track (one chart per song). */
  tracks: Record<string, BestResult>;
  plays: number;
}

export type SaveData = SaveDataV2;

export const CURRENT_VERSION = 2;

export const EMPTY_SAVE: SaveData = { version: 2, tracks: {}, plays: 0 };

const RANK_ORDER: Rank[] = ['D', 'C', 'B', 'A', 'S', 'SS'];

export function rankIndex(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

/**
 * Schema migrations, applied in order. Each entry upgrades from `from` to `from + 1`.
 *  v0 → v1: pre-versioned blobs.
 *  v1 → v2: three charts per track (easy/normal/hard) collapsed into one — keep the best result.
 */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
  0: (data) => ({ version: 1, tracks: (data.tracks as Record<string, unknown>) ?? {}, plays: 0 }),
  1: (data) => {
    const src = (data.tracks as Record<string, Partial<Record<string, BestResult>>>) ?? {};
    const tracks: Record<string, BestResult> = {};
    for (const [id, byDifficulty] of Object.entries(src)) {
      let best: BestResult | undefined;
      for (const r of Object.values(byDifficulty)) {
        if (!r) continue;
        if (!best || rankIndex(r.rank) > rankIndex(best.rank) || (rankIndex(r.rank) === rankIndex(best.rank) && r.score > best.score)) best = r;
      }
      if (best) tracks[id] = best;
    }
    return { version: 2, tracks, plays: typeof data.plays === 'number' ? data.plays : 0 };
  },
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
    version: 2,
    tracks: (data.tracks as Record<string, BestResult>) ?? {},
    plays: typeof data.plays === 'number' ? data.plays : 0,
  };
}

/** Stars earned on a track: 1 for a pass (rank ≥ C), +1 for A, +1 for S. */
export function starsForTrack(best: BestResult | undefined): number {
  if (!best) return 0;
  const r = rankIndex(best.rank);
  if (r < rankIndex('C')) return 0;
  if (r < rankIndex('A')) return 1;
  if (r < rankIndex('S')) return 2;
  return 3;
}

export function totalStars(save: SaveData, trackIds?: readonly string[]): number {
  const ids = trackIds ?? Object.keys(save.tracks);
  let sum = 0;
  for (const id of ids) sum += starsForTrack(save.tracks[id]);
  return sum;
}

/** Merge a new result; returns whether it beat the stored best score. */
export function mergeResult(save: SaveData, trackId: string, result: BestResult): { save: SaveData; newRecord: boolean } {
  const prev = save.tracks[trackId];
  const newRecord = !prev || result.score > prev.score;
  const merged: BestResult = newRecord
    ? { ...result, fullCombo: result.fullCombo || (prev?.fullCombo ?? false) }
    : { ...prev, fullCombo: prev.fullCombo || result.fullCombo, rank: RANK_ORDER[Math.max(rankIndex(prev.rank), rankIndex(result.rank))] };
  return { save: { ...save, plays: save.plays + 1, tracks: { ...save.tracks, [trackId]: merged } }, newRecord };
}
