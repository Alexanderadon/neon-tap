export type Judgement = 'perfect' | 'great' | 'good' | 'miss';
export type Rank = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';

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
  /** True when the player ran out of hearts — the run does not count. */
  failed: boolean;
  /** Hearts left at the end. */
  hearts: number;
  /** Judgement-by-judgement record of the run (empty when nothing was judged). */
  timeline: ResultTimeline;
  /** Song length in seconds — the time axis of `timeline`. */
  duration: number;
}
