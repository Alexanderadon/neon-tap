/**
 * The result screen's motion timeline, seconds (spec §3). Every animation is `both` and starts
 * from these marks; any tap before SETTLE jumps to the final state.
 */
export const T = {
  /** First star pops; the next ones follow every STAR_STEP (0.3 / 0.7 / 1.1). */
  STAR: 0.3,
  STAR_STEP: 0.4,
  /** Confetti falls over the stars only. */
  CONFETTI_FROM: 0.9,
  CONFETTI_TO: 1.9,
  VERDICT: 1.3,
  /** Tag + panel rise; the score starts counting at the same moment. */
  PANEL: 1.6,
  COUNT: 1.3,
  /** The score pops once it has landed; the tag shines. */
  SCORE_POP: 2.9,
  SHINE: 3.0,
  /** Coins drop 3.0 / 3.1 / 3.2. */
  COIN: 3.0,
  COIN_STEP: 0.1,
  UNLOCK: 3.3,
  UNLOCK_GROW: 3.6,
  TRIO: 3.4,
  PRIMARY: 3.5,
  BEAT: 3.9,
  /** Loot flights: three crystals from 3.5, two stars from 3.8. */
  FLY_CRYSTALS: 3.5,
  FLY_STARS: 3.8,
  FLY_STEP: 0.1,
  FLY_DURATION: 0.7,
  /** The wallet chips tick. */
  TICK_CRYSTALS: 4.1,
  TICK_STARS: 4.3,
  /** Everything is over. */
  SETTLE: 4.7,
} as const;

/** Failed run: the verdict shows at 0.3, the panel at 0.8, the buttons at once (spec §3). */
export const T_FAILED = { VERDICT: 0.3, PANEL: 0.8, UNLOCK: 1.0, TRIO: 0, PRIMARY: 0, SETTLE: 1.4 } as const;

/** When the screen may be considered over (the page's skip timer): the full timeline, or the short one after a fail. */
export const SETTLE_SECONDS = { normal: T.SETTLE, failed: T_FAILED.SETTLE } as const;
