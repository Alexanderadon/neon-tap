export type Judgement = 'perfect' | 'great' | 'good' | 'miss';
export type Rank = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';

/** Ranks from the lowest to the highest — the one order records merge by (catalog tracks and own songs). */
export const RANK_ORDER: readonly Rank[] = ['D', 'C', 'B', 'A', 'S', 'SS'];

export interface JudgementCounts {
  perfect: number;
  great: number;
  good: number;
  miss: number;
}

/**
 * Every judgement of a run in order: song time (seconds), verdict and the combo right after it.
 * Parallel arrays — index `i` describes one judgement.
 */
export interface ResultTimeline {
  t: number[];
  j: Judgement[];
  combo: number[];
}

export interface PlayResult {
  trackId: string;
  score: number;
  accuracy: number;
  rank: Rank;
  maxCombo: number;
  totalNotes: number;
  counts: JudgementCounts;
  fullCombo: boolean;
  /** Notes that would need to be Perfect to reach rank S (0 when already S or SS). */
  notesToS: number;
  /** True when the player ran out of hearts before the first star — the run does not count. */
  failed: boolean;
  /** Levels finished (0–3): a star each. */
  stars: number;
  /** Endless loops finished past the third level: a crown each (0 outside endless mode). */
  crowns: number;
  /** The run was endless: the song looped past three stars, faster every loop. */
  endless: boolean;
  /** Endless runs only: the score of the whole run, loops included (`score` stops at the third star so records compare like with like). */
  endlessScore?: number;
  /** The level the run ended on (1-based; endless loops count on from 4). */
  level: number;
  /** Hearts left at the end. */
  hearts: number;
  /** Judgement-by-judgement record of the run (empty when nothing was judged). */
  timeline: ResultTimeline;
  /** Song length in seconds — the time axis of `timeline`. */
  duration: number;
  /** Where every level started (song seconds): past a skipped long intro, else 0 (absent in older results). What the player heard counts from here. */
  startSec?: number;
  /** Crystals collected during the run (gem notes hit); credited to the wallet unless the run failed. */
  crystals: number;
}
