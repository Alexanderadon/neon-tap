export type Judgement = 'perfect' | 'great' | 'good' | 'miss';
export type Rank = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';

export interface JudgementCounts {
  perfect: number;
  great: number;
  good: number;
  miss: number;
}

export interface PlayResult {
  trackId: string;
  difficulty: 'easy' | 'normal' | 'hard';
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
}
