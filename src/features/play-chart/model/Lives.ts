/**
 * Hearts. Every miss costs one; a streak of clean hits earns one back (up to the five shown); a
 * heart spell adds one — and past five it gilds a shown heart: five gold hearts on top are five
 * more lives, drawn in the same five slots. Past ten a caught heart overflows (the caller pays
 * crystals for it). Zero hearts = the run fails and restarts (GDD §3).
 */
export class Lives {
  hearts: number;
  streak = 0;

  constructor(
    /** Hearts shown; also the ceiling for streak regeneration. */
    readonly max = 5,
    /** Consecutive non-miss judgements needed to regain a heart. */
    readonly regenStreak = 25,
  ) {
    this.hearts = max;
  }

  /** Hearts including the gilded ones: twice the shown count. */
  get cap(): number {
    return this.max * 2;
  }

  /** Gilded hearts: lives beyond the five shown. */
  get gold(): number {
    return Math.max(0, this.hearts - this.max);
  }

  reset(): void {
    this.hearts = this.max;
    this.streak = 0;
  }

  /** A new level: the five shown hearts are topped up; gilded ones stay. The streak starts over. */
  refill(): void {
    this.hearts = Math.max(this.hearts, this.max);
    this.streak = 0;
  }

  get dead(): boolean {
    return this.hearts <= 0;
  }

  /** Register a successful judgement; returns true when a heart was regained (streaks never gild). */
  hit(): boolean {
    this.streak++;
    if (this.streak % this.regenStreak === 0) return this.gain();
    return false;
  }

  /** Register a miss (a gilded heart goes first); returns true when the player is out of hearts. */
  miss(): boolean {
    this.streak = 0;
    this.hearts = Math.max(0, this.hearts - 1);
    return this.dead;
  }

  /** Add a heart up to the shown five; returns true when the count actually increased. */
  gain(): boolean {
    if (this.hearts >= this.max) return false;
    this.hearts++;
    return true;
  }

  /** A caught heart spell: fills, then gilds, up to the cap; returns false when it overflows (pay crystals instead). */
  catchHeart(): boolean {
    if (this.hearts >= this.cap) return false;
    this.hearts++;
    return true;
  }
}
