/**
 * Revive for a rewarded ad (GDD «Реклама за награду»): when the fifth heart is lost the run freezes
 * instead of failing and offers five hearts back for a video — once per run. Pure state and timing;
 * the session and the canvas host both read it (see GameSession / GameCanvas).
 */

/** Seconds the offer stays open (the RingCountdown in the primary button). */
export const REVIVE_OFFER_SEC = 5;
/** Hearts given back. */
export const REVIVE_HEARTS = 5;
/** Ages (seconds after the reward) at which each heart pops back, in the panel and in the HUD. */
export const REFILL_AT: readonly number[] = [0.4, 0.65, 0.9, 1.15, 1.4];
/** The «3 / 2 / 1» after the refill: first digit at 1.9 s, one second each; music and notes go on at 4.9 s. */
export const REVIVE_COUNT_START = 1.9;
export const REVIVE_COUNT_DIGITS = 3;
export const REVIVE_RESUME_AT = REVIVE_COUNT_START + REVIVE_COUNT_DIGITS;

export type RevivePhase =
  /** Playing (or nothing to offer). */
  | 'idle'
  /** Hearts ran out: the panel with five empty hearts and the 5 s offer. */
  | 'offer'
  /** The rewarded video plays. */
  | 'ad'
  /** Rewarded: hearts pop back one by one, then the count-in, then the run resumes. */
  | 'refill';

export interface ReviveState {
  phase: RevivePhase;
  /** The one revive of this run is spent (offered and accepted, or declined). */
  used: boolean;
}

export type ReviveAction =
  /** The session ran out of hearts and can offer a revive. */
  | { type: 'hearts-out' }
  /** The player tapped «Продолжить». */
  | { type: 'accept' }
  /** The ad ended with its reward. */
  | { type: 'rewarded' }
  /** «К результату», the 5 s ran out, or the ad was closed / failed. */
  | { type: 'decline' }
  /** The session resumed play after the count-in. */
  | { type: 'resumed' }
  /** A new run: everything is available again. */
  | { type: 'restart' };

export const REVIVE_IDLE: ReviveState = { phase: 'idle', used: false };

/** Whether the session may offer a revive now (once per run, only while hearts are shown). */
export function canOfferRevive(used: boolean, enabled: boolean): boolean {
  return enabled && !used;
}

/** The revive state machine: idle → offer → ad → refill → idle; decline from offer / ad ends it for the run. */
export function reviveReducer(state: ReviveState, action: ReviveAction): ReviveState {
  switch (action.type) {
    case 'hearts-out':
      return state.phase === 'idle' && !state.used ? { phase: 'offer', used: false } : state;
    case 'accept':
      return state.phase === 'offer' ? { phase: 'ad', used: true } : state;
    case 'rewarded':
      return state.phase === 'ad' ? { phase: 'refill', used: true } : state;
    case 'decline':
      return state.phase === 'offer' || state.phase === 'ad' ? { phase: 'idle', used: true } : state;
    case 'resumed':
      return state.phase === 'refill' ? { phase: 'idle', used: true } : state;
    case 'restart':
      return REVIVE_IDLE;
  }
}

/** How many of the five hearts have popped back `age` seconds after the reward (0..5). */
export function heartsRefilled(age: number): number {
  let n = 0;
  for (const t of REFILL_AT) if (age >= t) n++;
  return n;
}

/** The count-in digit shown `age` seconds after the reward (3, 2, 1), or null outside the count-in. */
export function reviveCountdown(age: number): number | null {
  if (age < REVIVE_COUNT_START || age >= REVIVE_RESUME_AT) return null;
  return REVIVE_COUNT_DIGITS - Math.floor(age - REVIVE_COUNT_START);
}

/** 0..1 through the current count-in digit (drives its pop), 0 outside the count-in. */
export function reviveDigitProgress(age: number): number {
  if (age < REVIVE_COUNT_START || age >= REVIVE_RESUME_AT) return 0;
  return (age - REVIVE_COUNT_START) % 1;
}
