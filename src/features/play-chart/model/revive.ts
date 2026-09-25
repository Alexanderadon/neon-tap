/**
 * The second chance: when the fifth heart is lost the run freezes instead of failing and offers
 * five hearts back — once per run. With NEON PASS «Продолжить» gives them at once, without an ad;
 * without PASS «Смотреть рекламу» plays a rewarded ad (placement `'revive'`) and the hearts come
 * back only when it ends with its reward. Crystals are never asked. Without PASS and without an ad
 * provider (the live site has no ad network yet) nothing is offered at all — the run ends as it
 * always did. Pure state and timing; the session and the canvas host both read it (see
 * GameSession / GameCanvas).
 */
import type { AdOutcome, RewardedAd } from '@/shared/lib/ads';

/** Seconds the offer stays open (the RingCountdown in the primary button). It stands still while the ad plays. */
export const REVIVE_OFFER_SEC = 5;
/**
 * The primary button takes a tap only after it has risen (0.8 s delay + 0.4 s rise, game-canvas.css):
 * the frame opens while the fingers are still hitting the lanes, and a stray tap must never start an ad.
 */
export const REVIVE_ARM_MS = 1200;
/** Hearts given back. */
export const REVIVE_HEARTS = 5;
/** Ages (seconds after the hearts were granted) at which each heart pops back, in the panel and in the HUD. */
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
  /** No NEON PASS: the rewarded ad plays; the offer's 5 s stand still. */
  | 'ad'
  /** Granted (the ad's reward, or NEON PASS): hearts pop back one by one, then the count-in, then the run resumes. */
  | 'refill';

export interface ReviveState {
  phase: RevivePhase;
  /** The one second chance of this run is spent (accepted or declined). */
  used: boolean;
  /**
   * NEON PASS when the offer opened: the button then says «бесплатно» and gives the hearts without
   * an ad. Fixed for the whole offer, so the button never promises one thing and does another.
   */
  pass: boolean;
}

export type ReviveAction =
  /** The session ran out of hearts and can offer a second chance; `pass` — NEON PASS is active. */
  | { type: 'hearts-out'; pass: boolean }
  /** The player tapped the armed primary button: with NEON PASS the hearts come back, otherwise the ad starts. */
  | { type: 'accept' }
  /** The ad ended with its reward. */
  | { type: 'rewarded' }
  /** «К результату», or the ad was closed early / failed: nothing is given. */
  | { type: 'decline' }
  /** The offer's 5 s ran out (ignored while the ad plays: the timer stands still then). */
  | { type: 'timeout' }
  /** The session resumed play after the count-in. */
  | { type: 'resumed' }
  /** A new run: everything is available again. */
  | { type: 'restart' };

export const REVIVE_IDLE: ReviveState = { phase: 'idle', used: false, pass: false };

/** Whether the session may offer a second chance now (once per run, only while hearts are shown). */
export function canOfferRevive(used: boolean, enabled: boolean): boolean {
  return enabled && !used;
}

/**
 * The second chance exists for this player right now: NEON PASS (free, no ad), or an ad provider
 * that can show the rewarded ad. Neither — nothing is offered, the run simply ends.
 */
export function reviveAvailable(pass: boolean, adsAvailable: boolean): boolean {
  return pass || adsAvailable;
}

/** The primary button is armed: the offer opened at `offerAt` (ms, the same clock as `nowMs`) at least `REVIVE_ARM_MS` ago. */
export function reviveArmed(offerAt: number | null, nowMs: number): boolean {
  return offerAt !== null && nowMs - offerAt >= REVIVE_ARM_MS;
}

/**
 * The second-chance state machine: idle → offer → (NEON PASS) refill, or offer → ad → refill on the
 * reward; a decline, a closed or failed ad, or the offer's timeout ends it for the run.
 */
export function reviveReducer(state: ReviveState, action: ReviveAction): ReviveState {
  switch (action.type) {
    case 'hearts-out':
      return state.phase === 'idle' && !state.used ? { phase: 'offer', used: false, pass: action.pass } : state;
    case 'accept':
      return state.phase === 'offer' ? { ...state, phase: state.pass ? 'refill' : 'ad', used: true } : state;
    case 'rewarded':
      return state.phase === 'ad' ? { ...state, phase: 'refill' } : state;
    case 'decline':
      return state.phase === 'offer' || state.phase === 'ad' ? { ...state, phase: 'idle', used: true } : state;
    case 'timeout':
      return state.phase === 'offer' ? { ...state, phase: 'idle', used: true } : state;
    case 'resumed':
      return state.phase === 'refill' ? { ...state, phase: 'idle' } : state;
    case 'restart':
      return REVIVE_IDLE;
  }
}

/**
 * What the host does after a step: `'ad'` — play the rewarded ad; `'revive'` — give the hearts back
 * (`session.revive()`); `'fail'` — the second chance is gone, end the run (`session.declineRevive()`);
 * `'none'` — nothing.
 */
export type ReviveEffect = 'none' | 'ad' | 'revive' | 'fail';

/**
 * One step of the machine together with what the host must do about it. An action that does not
 * fit the phase changes nothing and asks for nothing (the offer's timeout while the ad plays, a
 * late ad result after a restart); a restart never ends the run.
 */
export function reviveStep(state: ReviveState, action: ReviveAction): { state: ReviveState; effect: ReviveEffect } {
  const next = reviveReducer(state, action);
  if (next === state || action.type === 'restart') return { state: next, effect: 'none' };
  if (next.phase === 'ad') return { state: next, effect: 'ad' };
  if (next.phase === 'refill') return { state: next, effect: 'revive' };
  if (next.phase === 'idle' && (state.phase === 'offer' || state.phase === 'ad')) return { state: next, effect: 'fail' };
  return { state: next, effect: 'none' };
}

/** How the ad's end moves the second chance on: the hearts only on `'rewarded'`; closed early or failed — nothing. */
export function reviveAdAction(outcome: AdOutcome): ReviveAction {
  return outcome === 'rewarded' ? { type: 'rewarded' } : { type: 'decline' };
}

/**
 * Play the second chance's rewarded ad (placement `'revive'`) and turn its end into the next action.
 * Never rejects: a provider that throws counts as a failed ad — nothing is given.
 */
export async function watchReviveAd(ads: Pick<RewardedAd, 'show'>): Promise<ReviveAction> {
  try {
    return reviveAdAction(await ads.show('revive'));
  } catch {
    return reviveAdAction('failed');
  }
}

/** How many of the five hearts have popped back `age` seconds after they were granted (0..5). */
export function heartsRefilled(age: number): number {
  let n = 0;
  for (const t of REFILL_AT) if (age >= t) n++;
  return n;
}

/** The count-in digit shown `age` seconds after the hearts were granted (3, 2, 1), or null outside the count-in. */
export function reviveCountdown(age: number): number | null {
  if (age < REVIVE_COUNT_START || age >= REVIVE_RESUME_AT) return null;
  return REVIVE_COUNT_DIGITS - Math.floor(age - REVIVE_COUNT_START);
}

/** 0..1 through the current count-in digit (drives its pop), 0 outside the count-in. */
export function reviveDigitProgress(age: number): number {
  if (age < REVIVE_COUNT_START || age >= REVIVE_RESUME_AT) return 0;
  return (age - REVIVE_COUNT_START) % 1;
}
