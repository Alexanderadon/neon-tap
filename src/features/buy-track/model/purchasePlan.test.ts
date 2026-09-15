import { describe, expect, it } from 'vitest';
import { purchasePaths, purchasePlan } from './purchasePlan';

describe('purchasePlan', () => {
  it('shows price, balance and what remains when affordable', () => {
    expect(purchasePlan(173, 758)).toEqual({ price: 173, have: 758, remaining: 585, short: 0, affordable: true });
    // the exact balance is enough
    expect(purchasePlan(100, 100)).toMatchObject({ remaining: 0, short: 0, affordable: true });
  });

  it('shows the shortfall when the balance is short', () => {
    expect(purchasePlan(218, 158)).toEqual({ price: 218, have: 158, remaining: 0, short: 60, affordable: false });
  });

  it('never goes negative or fractional', () => {
    expect(purchasePlan(-5, 10)).toMatchObject({ price: 0, short: 0, affordable: true, remaining: 10 });
    expect(purchasePlan(Number.NaN, Number.NaN)).toMatchObject({ price: 0, have: 0, affordable: true });
    expect(purchasePlan(70.4, 99.9)).toMatchObject({ price: 70, have: 99, remaining: 29 });
  });
});

describe('purchasePaths', () => {
  it('affordable: the cyan button buys, the ad is the second way only when a provider exists', () => {
    expect(purchasePaths({ affordable: true }, true)).toEqual({ primary: 'buy', adRow: true });
    expect(purchasePaths({ affordable: true }, false)).toEqual({ primary: 'buy', adRow: false });
  });

  it('short: the ad takes the cyan button; without ads the player is sent to earn', () => {
    expect(purchasePaths({ affordable: false }, true)).toEqual({ primary: 'ad', adRow: false });
    expect(purchasePaths({ affordable: false }, false)).toEqual({ primary: 'earn', adRow: false });
  });
});
