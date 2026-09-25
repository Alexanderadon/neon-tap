import { describe, expect, it, vi } from 'vitest';
import {
  REFILL_AT,
  REVIVE_COUNT_START,
  REVIVE_HEARTS,
  REVIVE_IDLE,
  REVIVE_OFFER_SEC,
  REVIVE_PRICE,
  REVIVE_RESUME_AT,
  canOfferRevive,
  heartsRefilled,
  payForRevive,
  reviveAffordable,
  reviveCountdown,
  reviveDigitProgress,
  revivePrice,
  reviveReducer,
  type ReviveAction,
  type ReviveState,
} from './revive';

function run(actions: ReviveAction[], from: ReviveState = REVIVE_IDLE): ReviveState {
  return actions.reduce(reviveReducer, from);
}

describe('second chance state machine', () => {
  it('offers once per run: idle → offer → refill → idle, then never again — no ad phase', () => {
    expect(run([{ type: 'hearts-out' }])).toEqual({ phase: 'offer', used: false });
    expect(run([{ type: 'hearts-out' }, { type: 'accept' }])).toEqual({ phase: 'refill', used: true });
    const done = run([{ type: 'hearts-out' }, { type: 'accept' }, { type: 'resumed' }]);
    expect(done).toEqual({ phase: 'idle', used: true });
    // Hearts run out a second time: no offer.
    expect(reviveReducer(done, { type: 'hearts-out' })).toBe(done);
  });

  it('declining (button, timeout) spends the second chance without a refill', () => {
    expect(run([{ type: 'hearts-out' }, { type: 'decline' }])).toEqual({ phase: 'idle', used: true });
    // a decline during the refill changes nothing: the hearts are already paid for
    const refill = run([{ type: 'hearts-out' }, { type: 'accept' }]);
    expect(reviveReducer(refill, { type: 'decline' })).toBe(refill);
  });

  it('ignores actions that do not fit the phase', () => {
    expect(reviveReducer(REVIVE_IDLE, { type: 'accept' })).toBe(REVIVE_IDLE);
    expect(reviveReducer(REVIVE_IDLE, { type: 'decline' })).toBe(REVIVE_IDLE);
    expect(reviveReducer(REVIVE_IDLE, { type: 'resumed' })).toBe(REVIVE_IDLE);
    const offer = run([{ type: 'hearts-out' }]);
    expect(reviveReducer(offer, { type: 'resumed' })).toBe(offer);
    expect(reviveReducer(offer, { type: 'hearts-out' })).toBe(offer);
  });

  it('restart makes the second chance available again', () => {
    const spent = run([{ type: 'hearts-out' }, { type: 'decline' }]);
    expect(reviveReducer(spent, { type: 'restart' })).toEqual(REVIVE_IDLE);
    expect(run([{ type: 'restart' }, { type: 'hearts-out' }], spent).phase).toBe('offer');
  });

  it('canOfferRevive: enabled and unused', () => {
    expect(canOfferRevive(false, true)).toBe(true);
    expect(canOfferRevive(true, true)).toBe(false);
    expect(canOfferRevive(false, false)).toBe(false);
  });
});

describe('second chance price', () => {
  it('costs 30 crystals, nothing with NEON PASS', () => {
    expect(REVIVE_PRICE).toBe(30);
    expect(revivePrice(false)).toBe(30);
    expect(revivePrice(true)).toBe(0);
  });

  it('exists only with NEON PASS or at least 30 crystals — otherwise it is not offered at all', () => {
    expect(reviveAffordable(false, 29)).toBe(false);
    expect(reviveAffordable(false, 30)).toBe(true);
    expect(reviveAffordable(false, 0)).toBe(false);
    expect(reviveAffordable(true, 0)).toBe(true);
  });

  it('pays 30 crystals through the wallet; with NEON PASS the wallet is not touched', () => {
    const spend = vi.fn(() => true);
    expect(payForRevive(false, spend)).toBe(true);
    expect(spend).toHaveBeenCalledWith(30);
    const untouched = vi.fn(() => true);
    expect(payForRevive(true, untouched)).toBe(true);
    expect(untouched).not.toHaveBeenCalled();
    // the wallet refused (spent in another tab meanwhile): no second chance
    expect(payForRevive(false, () => false)).toBe(false);
  });

  it('with a real wallet: 30 leave the balance once, a short balance pays nothing', () => {
    let balance = 45;
    const spend = (n: number) => {
      if (balance < n) return false;
      balance -= n;
      return true;
    };
    expect(payForRevive(false, spend)).toBe(true);
    expect(balance).toBe(15);
    expect(reviveAffordable(false, balance)).toBe(false);
    expect(payForRevive(false, spend)).toBe(false);
    expect(balance).toBe(15);
  });
});

describe('second chance timing', () => {
  it('constants match the mock: 5 s offer, five hearts, count-in 1.9 → 4.9 s', () => {
    expect(REVIVE_OFFER_SEC).toBe(5);
    expect(REVIVE_HEARTS).toBe(5);
    expect(REFILL_AT).toEqual([0.4, 0.65, 0.9, 1.15, 1.4]);
    expect(REVIVE_COUNT_START).toBe(1.9);
    expect(REVIVE_RESUME_AT).toBeCloseTo(4.9);
    expect(REFILL_AT[REFILL_AT.length - 1]).toBeLessThan(REVIVE_COUNT_START);
  });

  it('hearts pop back one by one', () => {
    expect(heartsRefilled(0)).toBe(0);
    expect(heartsRefilled(0.39)).toBe(0);
    expect(heartsRefilled(0.4)).toBe(1);
    expect(heartsRefilled(0.9)).toBe(3);
    expect(heartsRefilled(1.4)).toBe(5);
    expect(heartsRefilled(10)).toBe(5);
  });

  it('counts 3, 2, 1 with one second per digit and nothing outside', () => {
    expect(reviveCountdown(1.8)).toBeNull();
    expect(reviveCountdown(1.9)).toBe(3);
    expect(reviveCountdown(2.89)).toBe(3);
    expect(reviveCountdown(2.9)).toBe(2);
    expect(reviveCountdown(3.9)).toBe(1);
    expect(reviveCountdown(4.89)).toBe(1);
    expect(reviveCountdown(4.9)).toBeNull();
    expect(reviveDigitProgress(1.9)).toBeCloseTo(0);
    expect(reviveDigitProgress(2.4)).toBeCloseTo(0.5);
    expect(reviveDigitProgress(0)).toBe(0);
  });
});
