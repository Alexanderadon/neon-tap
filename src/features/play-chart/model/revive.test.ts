import { describe, expect, it, vi } from 'vitest';
import type { AdOutcome, AdPlacement } from '@/shared/lib/ads';
import * as reviveModule from './revive';
import {
  REFILL_AT,
  REVIVE_ARM_MS,
  REVIVE_COUNT_START,
  REVIVE_HEARTS,
  REVIVE_IDLE,
  REVIVE_OFFER_SEC,
  REVIVE_RESUME_AT,
  canOfferRevive,
  heartsRefilled,
  reviveAdAction,
  reviveArmed,
  reviveAvailable,
  reviveCountdown,
  reviveDigitProgress,
  reviveKeysLocked,
  reviveReducer,
  reviveStep,
  watchReviveAd,
  type ReviveAction,
  type ReviveState,
} from './revive';

function run(actions: ReviveAction[], from: ReviveState = REVIVE_IDLE): ReviveState {
  return actions.reduce(reviveReducer, from);
}

const OUT_PASS: ReviveAction = { type: 'hearts-out', pass: true };
const OUT_FREE: ReviveAction = { type: 'hearts-out', pass: false };

/** A provider that records the placement and ends the ad with `outcome` (or throws). */
function fakeAds(outcome: AdOutcome | Error) {
  const placements: AdPlacement[] = [];
  return {
    placements,
    show: vi.fn(async (placement: AdPlacement) => {
      placements.push(placement);
      if (outcome instanceof Error) throw outcome;
      return outcome;
    }),
  };
}

describe('second chance with NEON PASS: free, no ad', () => {
  it('offer → refill → idle, once per run', () => {
    expect(run([OUT_PASS])).toEqual({ phase: 'offer', used: false, pass: true });
    expect(run([OUT_PASS, { type: 'accept' }])).toEqual({ phase: 'refill', used: true, pass: true });
    const done = run([OUT_PASS, { type: 'accept' }, { type: 'resumed' }]);
    expect(done).toMatchObject({ phase: 'idle', used: true });
    // Hearts run out a second time: no offer.
    expect(reviveReducer(done, OUT_PASS)).toBe(done);
  });

  it('accepting gives the hearts at once — the host never plays an ad', () => {
    const offer = run([OUT_PASS]);
    expect(reviveStep(offer, { type: 'accept' }).effect).toBe('revive');
  });
});

describe('second chance without NEON PASS: for a rewarded ad', () => {
  it('offer → ad → (rewarded) refill → idle', () => {
    const ad = run([OUT_FREE, { type: 'accept' }]);
    expect(ad).toEqual({ phase: 'ad', used: true, pass: false });
    expect(reviveReducer(ad, { type: 'rewarded' })).toEqual({ phase: 'refill', used: true, pass: false });
    expect(run([{ type: 'rewarded' }, { type: 'resumed' }], ad)).toMatchObject({ phase: 'idle', used: true });
  });

  it('accepting starts the ad, and only the reward brings the hearts back', () => {
    const offer = run([OUT_FREE]);
    const accepted = reviveStep(offer, { type: 'accept' });
    expect(accepted.effect).toBe('ad');
    expect(reviveStep(accepted.state, { type: 'rewarded' })).toEqual({ state: { phase: 'refill', used: true, pass: false }, effect: 'revive' });
  });

  it('an ad closed early or failed gives nothing and ends the run', () => {
    const ad = run([OUT_FREE, { type: 'accept' }]);
    for (const outcome of ['closed', 'failed'] as const) {
      const action = reviveAdAction(outcome);
      expect(action).toEqual({ type: 'decline' });
      expect(reviveStep(ad, action)).toEqual({ state: { phase: 'idle', used: true, pass: false }, effect: 'fail' });
    }
    expect(reviveAdAction('rewarded')).toEqual({ type: 'rewarded' });
  });

  it('the offer timer stands still while the ad plays: a late timeout changes nothing', () => {
    const ad = run([OUT_FREE, { type: 'accept' }]);
    expect(reviveStep(ad, { type: 'timeout' })).toEqual({ state: ad, effect: 'none' });
    // …while on the offer itself the 5 s running out ends the run
    expect(reviveStep(run([OUT_FREE]), { type: 'timeout' }).effect).toBe('fail');
  });

  it('a reward that arrives after a restart is ignored', () => {
    const restarted = run([OUT_FREE, { type: 'accept' }, { type: 'restart' }]);
    expect(restarted).toEqual(REVIVE_IDLE);
    expect(reviveStep(restarted, { type: 'rewarded' })).toEqual({ state: restarted, effect: 'none' });
  });

  it('plays the ad with the placement "revive" and never rejects', async () => {
    const rewarded = fakeAds('rewarded');
    await expect(watchReviveAd(rewarded)).resolves.toEqual({ type: 'rewarded' });
    expect(rewarded.placements).toEqual(['revive']);
    await expect(watchReviveAd(fakeAds('closed'))).resolves.toEqual({ type: 'decline' });
    await expect(watchReviveAd(fakeAds('failed'))).resolves.toEqual({ type: 'decline' });
    await expect(watchReviveAd(fakeAds(new Error('sdk')))).resolves.toEqual({ type: 'decline' });
  });
});

describe('second chance availability', () => {
  it('exists with NEON PASS or an ad to show; without both it is not offered at all', () => {
    expect(reviveAvailable(true, false)).toBe(true);
    expect(reviveAvailable(true, true)).toBe(true);
    expect(reviveAvailable(false, true)).toBe(true);
    expect(reviveAvailable(false, false)).toBe(false);
  });

  it('canOfferRevive: enabled and unused', () => {
    expect(canOfferRevive(false, true)).toBe(true);
    expect(canOfferRevive(true, true)).toBe(false);
    expect(canOfferRevive(false, false)).toBe(false);
  });

  it('never costs crystals: no price, no wallet', () => {
    const names = Object.keys(reviveModule);
    for (const gone of ['REVIVE_PRICE', 'revivePrice', 'reviveAffordable', 'payForRevive']) expect(names).not.toContain(gone);
  });

  it('takes the tap only once the button has risen: a lane tap as the hearts run out starts no ad', () => {
    expect(REVIVE_ARM_MS).toBe(1200);
    expect(reviveArmed(null, 5000)).toBe(false);
    expect(reviveArmed(1000, 1000)).toBe(false);
    expect(reviveArmed(1000, 1000 + REVIVE_ARM_MS - 1)).toBe(false);
    expect(reviveArmed(1000, 1000 + REVIVE_ARM_MS)).toBe(true);
  });

  it('the keys wait while the ad plays: R never restarts the run under the ad', () => {
    expect(reviveKeysLocked(run([OUT_FREE, { type: 'accept' }]).phase)).toBe(true);
    for (const state of [REVIVE_IDLE, run([OUT_FREE]), run([OUT_PASS, { type: 'accept' }])]) expect(reviveKeysLocked(state.phase)).toBe(false);
  });
});

describe('second chance state machine', () => {
  it('declining («К результату», timeout) spends the second chance without a refill', () => {
    expect(run([OUT_FREE, { type: 'decline' }])).toMatchObject({ phase: 'idle', used: true });
    expect(reviveStep(run([OUT_PASS]), { type: 'decline' }).effect).toBe('fail');
    // a decline during the refill changes nothing: the hearts are already given
    const refill = run([OUT_PASS, { type: 'accept' }]);
    expect(reviveReducer(refill, { type: 'decline' })).toBe(refill);
  });

  it('ignores actions that do not fit the phase', () => {
    for (const type of ['accept', 'rewarded', 'decline', 'timeout', 'resumed'] as const) {
      expect(reviveStep(REVIVE_IDLE, { type })).toEqual({ state: REVIVE_IDLE, effect: 'none' });
    }
    const offer = run([OUT_FREE]);
    expect(reviveReducer(offer, { type: 'resumed' })).toBe(offer);
    expect(reviveReducer(offer, { type: 'rewarded' })).toBe(offer);
    expect(reviveReducer(offer, OUT_PASS)).toBe(offer);
    const ad = run([{ type: 'accept' }], offer);
    expect(reviveReducer(ad, { type: 'accept' })).toBe(ad);
    expect(reviveReducer(ad, { type: 'resumed' })).toBe(ad);
  });

  it('restart makes the second chance available again and never ends the run itself', () => {
    const spent = run([OUT_FREE, { type: 'decline' }]);
    expect(reviveReducer(spent, { type: 'restart' })).toEqual(REVIVE_IDLE);
    expect(run([{ type: 'restart' }, OUT_FREE], spent).phase).toBe('offer');
    expect(reviveStep(run([OUT_FREE]), { type: 'restart' }).effect).toBe('none');
    expect(reviveStep(run([OUT_FREE, { type: 'accept' }]), { type: 'restart' }).effect).toBe('none');
  });

  it('opening the offer and resuming after the count-in ask nothing of the host', () => {
    expect(reviveStep(REVIVE_IDLE, OUT_FREE).effect).toBe('none');
    expect(reviveStep(run([OUT_PASS, { type: 'accept' }]), { type: 'resumed' }).effect).toBe('none');
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
