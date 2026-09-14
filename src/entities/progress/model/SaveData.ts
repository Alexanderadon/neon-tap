import type { Rank } from '@/shared/types/result';
import type { SpellKind } from '@/shared/types/chart';

export interface BestResult {
  score: number;
  accuracy: number;
  rank: Rank;
  maxCombo: number;
  fullCombo: boolean;
  playedAt: string;
  /** Most levels finished in one run (0–3), a star each; absent on saves from before levels (then the rank decides). */
  stars?: number;
}

export interface SaveDataV2 {
  version: 2;
  /** Best result per track (one chart per song). */
  tracks: Record<string, BestResult>;
  plays: number;
}

/** Lifetime counters feeding the goals (quests). */
export interface Counters {
  /** Spells caught, by kind (any song, failed runs included). */
  spells: Record<SpellKind, number>;
  /** Finished runs that were not failed (catalog + custom). */
  tracksPlayed: number;
  /** Best combo ever reached in a single run. */
  maxCombo: number;
  /** Hardest (★) built-in track completed without failing. */
  maxTrackStars: number;
  /** Genres of built-in tracks completed without failing (ids, unique). */
  genres: string[];
  /** Perfect judgements over all finished runs. */
  perfects: number;
  /** Finished, non-failed runs of the player's own songs. */
  customPlays: number;
}

/** Daily-track state: one bonus star per local day. */
export interface DailyState {
  /** Local date (YYYY-MM-DD) the daily track was last completed. */
  date: string;
  /** Bonus star already claimed on `date`. */
  done: boolean;
  /** Consecutive days with the daily track completed (as of `date`). */
  streak: number;
  /** Lifetime number of daily completions — each one is a bonus star. */
  total: number;
}

export interface SaveDataV3 {
  version: 3;
  tracks: Record<string, BestResult>;
  plays: number;
  counters: Counters;
  daily: DailyState;
  /** Ids of goals whose reward stars were granted. */
  goalsClaimed: string[];
}

export interface SaveDataV4 {
  version: 4;
  tracks: Record<string, BestResult>;
  plays: number;
  counters: Counters;
  daily: DailyState;
  goalsClaimed: string[];
  /** Crystal wallet: spendable balance. */
  crystals: number;
  /** Crystals ever collected (never decreases; stats / future goals). */
  lifetimeCrystals: number;
  /** Track ids bought in the shop — playable regardless of stars. */
  purchased: string[];
}

export interface SaveDataV5 extends Omit<SaveDataV4, 'version'> {
  version: 5;
}

export type SaveData = SaveDataV5;

export const CURRENT_VERSION = 5;

export const EMPTY_COUNTERS: Counters = { spells: { slow: 0, heart: 0 }, tracksPlayed: 0, maxCombo: 0, maxTrackStars: 0, genres: [], perfects: 0, customPlays: 0 };
export const EMPTY_DAILY: DailyState = { date: '', done: false, streak: 0, total: 0 };

export const EMPTY_SAVE: SaveData = {
  version: 5,
  tracks: {},
  plays: 0,
  counters: EMPTY_COUNTERS,
  daily: EMPTY_DAILY,
  goalsClaimed: [],
  crystals: 0,
  lifetimeCrystals: 0,
  purchased: [],
};

/** Fresh, unshared copy of the empty save (nested objects are cloned). */
export function emptySave(): SaveData {
  return {
    version: 5,
    tracks: {},
    plays: 0,
    counters: cloneCounters(EMPTY_COUNTERS),
    daily: { ...EMPTY_DAILY },
    goalsClaimed: [],
    crystals: 0,
    lifetimeCrystals: 0,
    purchased: [],
  };
}

function cloneCounters(c: Counters): Counters {
  return { ...c, spells: { ...c.spells } };
}

const RANK_ORDER: Rank[] = ['D', 'C', 'B', 'A', 'S', 'SS'];

export function rankIndex(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

function sanitizeCounters(raw: unknown): Counters {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const spells = (c.spells && typeof c.spells === 'object' ? c.spells : {}) as Record<string, unknown>;
  return {
    spells: { slow: num(spells.slow), heart: num(spells.heart) },
    tracksPlayed: num(c.tracksPlayed),
    maxCombo: num(c.maxCombo),
    maxTrackStars: num(c.maxTrackStars),
    genres: [...new Set(stringList(c.genres))],
    perfects: num(c.perfects),
    customPlays: num(c.customPlays),
  };
}

function sanitizeDaily(raw: unknown): DailyState {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    date: typeof d.date === 'string' ? d.date : '',
    done: d.done === true,
    streak: num(d.streak),
    total: num(d.total),
  };
}

/**
 * Schema migrations, applied in order. Each entry upgrades from `from` to `from + 1`.
 *  v0 → v1: pre-versioned blobs.
 *  v1 → v2: three charts per track (easy/normal/hard) collapsed into one — keep the best result.
 *  v2 → v3: progression — lifetime counters, daily track, claimed goals. Counters that can be
 *           derived from existing bests (max combo, tracks passed) are back-filled so an old
 *           player does not start the quests from zero.
 *  v3 → v4: crystal wallet — balance, lifetime total and purchased track ids, all starting empty.
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
  2: (data) => {
    const tracks = (data.tracks as Record<string, BestResult>) ?? {};
    const counters = cloneCounters(EMPTY_COUNTERS);
    for (const best of Object.values(tracks)) {
      if (!best) continue;
      counters.maxCombo = Math.max(counters.maxCombo, num(best.maxCombo));
      if (starsForTrack(best) > 0) counters.tracksPlayed++;
    }
    return { version: 3, tracks, plays: num(data.plays), counters, daily: { ...EMPTY_DAILY }, goalsClaimed: [] };
  },
  3: (data) => ({ ...data, version: 4, crystals: 0, lifetimeCrystals: 0, purchased: [] }),
  // v4 → v5: achievements — genre / perfect / custom-song counters (start at zero; goals claimed
  // under the old 8-quest list keep their ids, they simply never match a badge again).
  4: (data) => ({ ...data, version: 5 }),
};

const stringList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((g): g is string => typeof g === 'string') : []);

export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return emptySave();
  let data = raw as Record<string, unknown>;
  let version = typeof data.version === 'number' ? data.version : 0;
  while (version < CURRENT_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return emptySave();
    data = step(data);
    version++;
  }
  const crystals = Math.max(0, Math.floor(num(data.crystals)));
  return {
    version: 5,
    tracks: (data.tracks as Record<string, BestResult>) ?? {},
    plays: num(data.plays),
    counters: sanitizeCounters(data.counters),
    daily: sanitizeDaily(data.daily),
    goalsClaimed: stringList(data.goalsClaimed),
    crystals,
    lifetimeCrystals: Math.max(crystals, Math.floor(num(data.lifetimeCrystals))),
    purchased: [...new Set(stringList(data.purchased))],
  };
}

/** Stars earned on a track: the levels finished in the best run; saves from before levels are read by rank (C = 1, A = 2, S = 3). */
export function starsForTrack(best: BestResult | undefined): number {
  if (!best) return 0;
  if (best.stars !== undefined) return Math.max(0, Math.min(3, best.stars));
  const r = rankIndex(best.rank);
  if (r < rankIndex('C')) return 0;
  if (r < rankIndex('A')) return 1;
  if (r < rankIndex('S')) return 2;
  return 3;
}

/** Stars earned on tracks only (no bonuses). */
export function totalStars(save: SaveData, trackIds?: readonly string[]): number {
  const ids = trackIds ?? Object.keys(save.tracks);
  let sum = 0;
  for (const id of ids) sum += starsForTrack(save.tracks[id]);
  return sum;
}

/** Merge a new result; returns whether it beat the stored best score. Stars, rank and full combo never go down. */
export function mergeResult(save: SaveData, trackId: string, result: BestResult): { save: SaveData; newRecord: boolean } {
  const prev = save.tracks[trackId];
  const newRecord = !prev || result.score > prev.score;
  const stars = Math.max(starsForTrack(prev), starsForTrack(result));
  const merged: BestResult = newRecord
    ? { ...result, stars, fullCombo: result.fullCombo || (prev?.fullCombo ?? false) }
    : { ...prev, stars, fullCombo: prev.fullCombo || result.fullCombo, rank: RANK_ORDER[Math.max(rankIndex(prev.rank), rankIndex(result.rank))] };
  return { save: { ...save, plays: save.plays + 1, tracks: { ...save.tracks, [trackId]: merged } }, newRecord };
}

/** Count a caught spell. */
export function addSpell(save: SaveData, kind: SpellKind): SaveData {
  const spells = { ...save.counters.spells, [kind]: (save.counters.spells[kind] ?? 0) + 1 };
  return { ...save, counters: { ...save.counters, spells } };
}

/** Update the lifetime counters after a finished (non-failed) run. */
export function addRun(save: SaveData, run: { maxCombo: number; trackStars: number; perfects?: number; genre?: string; custom?: boolean }): SaveData {
  const c = save.counters;
  return {
    ...save,
    counters: {
      ...c,
      tracksPlayed: c.tracksPlayed + 1,
      maxCombo: Math.max(c.maxCombo, run.maxCombo),
      maxTrackStars: Math.max(c.maxTrackStars, run.trackStars),
      genres: run.genre && !c.genres.includes(run.genre) ? [...c.genres, run.genre] : c.genres,
      perfects: c.perfects + (run.perfects ?? 0),
      customPlays: c.customPlays + (run.custom ? 1 : 0),
    },
  };
}
