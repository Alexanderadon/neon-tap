import { HIT_WINDOWS, JUDGEMENT_SCORE, RANK_THRESHOLDS, type HitWindows } from '@/shared/config/constants';
import type { Judgement, JudgementCounts, Rank } from '@/shared/types/result';

/** Classify a hit by its timing error (seconds). `null` = outside the good window → not a hit. */
/** `early` widens the accepted lead (seconds before the note) beyond `good` — such taps are Good. */
export function judgeDelta(delta: number, windows: HitWindows = HIT_WINDOWS, early = windows.good): Judgement | null {
  const d = Math.abs(delta);
  if (d <= windows.perfect) return 'perfect';
  if (d <= windows.great) return 'great';
  if (d <= windows.good) return 'good';
  if (delta < 0 && -delta <= early) return 'good';
  return null;
}

/** Accuracy = share of tiles hit. A hit is a hit, however tidy: only misses count against you. */
export function accuracyOf(counts: JudgementCounts): number {
  const total = counts.perfect + counts.great + counts.good + counts.miss;
  if (total === 0) return 1;
  return (total - counts.miss) / total;
}

export function rankOf(accuracy: number): Rank {
  for (const { rank, min } of RANK_THRESHOLDS) if (accuracy >= min) return rank;
  return 'D';
}

/** Near-miss motivator: how many of the missed tiles, hit, would lift accuracy to `target`? */
export function notesToReach(counts: JudgementCounts, target: number): number {
  const total = counts.perfect + counts.great + counts.good + counts.miss;
  if (total === 0) return 0;
  const hits = total - counts.miss;
  const needed = Math.ceil(target * total - 1e-9);
  return Math.max(0, Math.min(counts.miss, needed - hits));
}

/** Combo multiplier: +25% per 50 combo, capped at ×3. */
export function comboMultiplier(combo: number): number {
  return Math.min(3, 1 + Math.floor(combo / 50) * 0.25);
}

export class Scoring {
  readonly counts: JudgementCounts = { perfect: 0, great: 0, good: 0, miss: 0 };
  combo = 0;
  maxCombo = 0;
  score = 0;
  judged = 0;

  /** Judgements the run can still produce: bonus items that went by untouched leave the count. */
  totalNotes: number;

  constructor(private readonly allNotes: number) {
    this.totalNotes = allNotes;
  }

  reset(): void {
    this.counts.perfect = this.counts.great = this.counts.good = this.counts.miss = 0;
    this.combo = this.maxCombo = this.score = this.judged = 0;
    this.totalNotes = this.allNotes;
  }

  /** A bonus item went by untouched: it is neither a hit nor a miss, so it no longer counts towards the total. */
  forgive(): void {
    this.totalNotes = Math.max(this.judged, this.totalNotes - 1);
  }

  /** Count a judgement. `breakCombo` = false keeps the combo through a miss (a failed spinner is its own thing). */
  register(j: Judgement, breakCombo = true): void {
    this.counts[j]++;
    this.judged++;
    if (j === 'miss') {
      if (breakCombo) this.combo = 0;
      return;
    }
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.score += Math.round(JUDGEMENT_SCORE[j] * comboMultiplier(this.combo));
  }

  /** Extra points outside the judgement system (spinner revolutions): no combo, no accuracy. */
  addBonus(points: number): void {
    this.score += Math.max(0, Math.round(points));
  }

  get accuracy(): number {
    return accuracyOf(this.counts);
  }

  get rank(): Rank {
    return rankOf(this.accuracy);
  }

  get isFullCombo(): boolean {
    return this.counts.miss === 0 && this.judged === this.totalNotes;
  }

  get progress(): number {
    return this.totalNotes === 0 ? 1 : this.judged / this.totalNotes;
  }
}
