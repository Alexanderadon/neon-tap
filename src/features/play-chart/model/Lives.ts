/**
 * Hearts. Every miss costs one; a streak of clean hits earns one back; a heart spell adds one.
 * Zero hearts = the run fails and restarts (GDD §3, "5 сердец либо начинаешь заново").
 */
export class Lives {
  hearts: number;
  streak = 0;

  constructor(
    readonly max = 5,
    /** Consecutive non-miss judgements needed to regain a heart. */
    readonly regenStreak = 25,
  ) {
    this.hearts = max;
  }

  reset(): void {
    this.hearts = this.max;
    this.streak = 0;
  }

  get dead(): boolean {
    return this.hearts <= 0;
  }

  /** Register a successful judgement; returns true when a heart was regained. */
  hit(): boolean {
    this.streak++;
    if (this.streak % this.regenStreak === 0) return this.gain();
    return false;
  }

  /** Register a miss; returns true when the player is out of hearts. */
  miss(): boolean {
    this.streak = 0;
    this.hearts = Math.max(0, this.hearts - 1);
    return this.dead;
  }

  /** Add hearts (heart spell); returns true when the count actually increased. */
  gain(n = 1): boolean {
    if (this.hearts >= this.max) return false;
    this.hearts = Math.min(this.max, this.hearts + n);
    return true;
  }
}
