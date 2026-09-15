import { describe, expect, it } from 'vitest';
import { pickAutoOffer, type AutoOfferInput } from './autoOffer';

const base: AutoOfferInput = { available: true, firstLaunchPending: false, limitedActive: false, limitedShown: false, musicDue: false };

describe('pickAutoOffer', () => {
  it('opens nothing by default, when the store is off, or over the first-launch flow', () => {
    expect(pickAutoOffer(base)).toBeNull();
    expect(pickAutoOffer({ ...base, limitedActive: true, musicDue: true, available: false })).toBeNull();
    expect(pickAutoOffer({ ...base, limitedActive: true, musicDue: true, firstLaunchPending: true })).toBeNull();
  });

  it('prefers the 48-hour deal, once per session', () => {
    expect(pickAutoOffer({ ...base, limitedActive: true, musicDue: true })).toBe('limited');
    expect(pickAutoOffer({ ...base, limitedActive: true, limitedShown: true, musicDue: true })).toBe('music');
    expect(pickAutoOffer({ ...base, limitedActive: true, limitedShown: true })).toBeNull();
  });

  it('opens the music pack when it is due', () => {
    expect(pickAutoOffer({ ...base, musicDue: true })).toBe('music');
  });
});
