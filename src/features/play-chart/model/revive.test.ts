import { describe, expect, it } from 'vitest';
import {
  REFILL_AT,
  REVIVE_COUNT_START,
  REVIVE_HEARTS,
  REVIVE_IDLE,
  REVIVE_OFFER_SEC,
  REVIVE_RESUME_AT,
  canOfferRevive,
  heartsRefilled,
  reviveCountdown,
  reviveDigitProgress,
  reviveReducer,
  type ReviveAction,
  type ReviveState,
} from './revive';

function run(actions: ReviveAction[], from: ReviveState = REVIVE_IDLE): ReviveState {
  return actions.reduce(reviveReducer, from);
}

describe('revive state machine', () => {
  it('offers once per run: idle → offer → ad → refill → idle, then never again', () => {
    expect(run([{ type: 'hearts-out' }])).toEqual({ phase: 'offer', used: false });
    expect(run([{ type: 'hearts-out' }, { type: 'accept' }])).toEqual({ phase: 'ad', used: true });
    expect(run([{ type: 'hearts-out' }, { type: 'accept' }, { type: 'rewarded' }])).toEqual({ phase: 'refill', used: true });
    const done = run([{ type: 'hearts-out' }, { type: 'accept' }, { type: 'rewarded' }, { type: 'resumed' }]);
    expect(done).toEqual({ phase: 'idle', used: true });
    // Hearts run out a second time: no offer.
    expect(reviveReducer(done, { type: 'hearts-out' })).toBe(done);
  });

  it('declining (button, timeout, closed ad) spends the revive without a reward', () => {
    expect(run([{ type: 'hearts-out' }, { type: 'decline' }])).toEqual({ phase: 'idle', used: true });
    expect(run([{ type: 'hearts-out' }, { type: 'accept' }, { type: 'decline' }])).toEqual({ phase: 'idle', used: true });
  });

  it('ignores actions that do not fit the phase', () => {
    expect(reviveReducer(REVIVE_IDLE, { type: 'accept' })).toBe(REVIVE_IDLE);
    expect(reviveReducer(REVIVE_IDLE, { type: 'rewarded' })).toBe(REVIVE_IDLE);
    expect(reviveReducer(REVIVE_IDLE, { type: 'decline' })).toBe(REVIVE_IDLE);
    const offer = run([{ type: 'hearts-out' }]);
    expect(reviveReducer(offer, { type: 'rewarded' })).toBe(offer);
    expect(reviveReducer(offer, { type: 'resumed' })).toBe(offer);
  });

  it('restart makes the revive available again', () => {
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

describe('revive timing', () => {
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
