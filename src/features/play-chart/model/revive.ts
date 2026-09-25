/**
 * The second chance: when the fifth heart is lost the run freezes instead of failing and offers
 * five hearts back for `REVIVE_PRICE` crystals (free with NEON PASS) — once per run, never for an
 * ad. It is not offered at all when the wallet cannot pay. Pure state and timing; the session and
 * the canvas host both read it (see GameSession / GameCanvas).
 */

/** Seconds the offer stays open (the RingCountdown in the primary button). */
export const REVIVE_OFFER_SEC = 5;
/**
 * «Продолжить» takes a tap only after it has risen (0.8 s delay + 0.4 s rise, game-canvas.css): the
 * frame opens while the fingers are still hitting the lanes, and a stray tap must never spend crystals.
 */
export const REVIVE_ARM_MS = 1200;
/** Hearts given back. */
export const REVIVE_HEARTS = 5;
/** Crystals the second chance costs; NEON PASS makes it free. */
export const REVIVE_PRICE = 30;
/** Ages (seconds after «Продолжить») at which each heart pops back, in the panel and in the HUD. */
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
  /** Paid: hearts pop back one by one, then the count-in, then the run resumes. */
  | 'refill';

export interface ReviveState {
  phase: RevivePhase;
  /** The one second chance of this run is spent (accepted or declined). */
  used: boolean;
}

export type ReviveAction =
  /** The session ran out of hearts and can offer a second chance. */
  | { type: 'hearts-out' }
  /** The player tapped «Продолжить» and the crystals were paid (or NEON PASS made it free). */
  | { type: 'accept' }
  /** «К результату», or the 5 s ran out. */
  | { type: 'decline' }
  /** The session resumed play after the count-in. */
  | { type: 'resumed' }
  /** A new run: everything is available again. */
  | { type: 'restart' };

export const REVIVE_IDLE: ReviveState = { phase: 'idle', used: false };

/** Whether the session may offer a second chance now (once per run, only while hearts are shown). */
export function canOfferRevive(used: boolean, enabled: boolean): boolean {
  return enabled && !used;
}

/** What the second chance costs this player: nothing with NEON PASS. */
export function revivePrice(pass: boolean): number {
  return pass ? 0 : REVIVE_PRICE;
}

/** The second chance exists for this player right now: NEON PASS, or enough crystals to pay for it. */
export function reviveAffordable(pass: boolean, crystals: number): boolean {
  return crystals >= revivePrice(pass);
}

/** «Продолжить» is armed: the offer opened at `offerAt` (ms, the same clock as `nowMs`) at least `REVIVE_ARM_MS` ago. */
export function reviveArmed(offerAt: number | null, nowMs: number): boolean {
  return offerAt !== null && nowMs - offerAt >= REVIVE_ARM_MS;
}

/**
 * Pay for the second chance through `spend` (the wallet's `spendCrystals`): free with NEON PASS,
 * otherwise `REVIVE_PRICE`. False when the wallet refused — then no hearts come back.
 */
export function payForRevive(pass: boolean, spend: (amount: number) => boolean): boolean {
  const price = revivePrice(pass);
  return price === 0 || spend(price);
}

/** The second-chance state machine: idle → offer → refill → idle; a decline ends it for the run. */
export function reviveReducer(state: ReviveState, action: ReviveAction): ReviveState {
  switch (action.type) {
    case 'hearts-out':
      return state.phase === 'idle' && !state.used ? { phase: 'offer', used: false } : state;
    case 'accept':
      return state.phase === 'offer' ? { phase: 'refill', used: true } : state;
    case 'decline':
      return state.phase === 'offer' ? { phase: 'idle', used: true } : state;
    case 'resumed':
      return state.phase === 'refill' ? { phase: 'idle', used: true } : state;
    case 'restart':
      return REVIVE_IDLE;
  }
}

/** How many of the five hearts have popped back `age` seconds after «Продолжить» (0..5). */
export function heartsRefilled(age: number): number {
  let n = 0;
  for (const t of REFILL_AT) if (age >= t) n++;
  return n;
}

/** The count-in digit shown `age` seconds after «Продолжить» (3, 2, 1), or null outside the count-in. */
export function reviveCountdown(age: number): number | null {
  if (age < REVIVE_COUNT_START || age >= REVIVE_RESUME_AT) return null;
  return REVIVE_COUNT_DIGITS - Math.floor(age - REVIVE_COUNT_START);
}

/** 0..1 through the current count-in digit (drives its pop), 0 outside the count-in. */
export function reviveDigitProgress(age: number): number {
  if (age < REVIVE_COUNT_START || age >= REVIVE_RESUME_AT) return 0;
  return (age - REVIVE_COUNT_START) % 1;
}
