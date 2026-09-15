import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMPTY_OFFERS,
  ensureOffersAnchor,
  limitedShownThisSession,
  markLimitedShownThisSession,
  markMusicOfferShown,
  markMusicPackBought,
  offersStore,
  resetOffers,
  resetSessionMemory,
  sanitizeOffers,
} from './offersStore';

describe('sanitizeOffers', () => {
  it('accepts a valid blob and drops garbage', () => {
    expect(sanitizeOffers({ anchor: 5, musicShownAt: 9, musicBought: true })).toEqual({ anchor: 5, musicShownAt: 9, musicBought: true });
    expect(sanitizeOffers({ anchor: 'x', musicShownAt: -1, musicBought: 'yes' })).toEqual(EMPTY_OFFERS);
    expect(sanitizeOffers(null)).toEqual(EMPTY_OFFERS);
    expect(sanitizeOffers('[]')).toEqual(EMPTY_OFFERS);
  });
});

describe('offersStore', () => {
  beforeEach(() => {
    resetOffers();
    resetSessionMemory();
  });

  it('pins the anchor once', () => {
    expect(offersStore.get().anchor).toBeNull();
    expect(ensureOffersAnchor(100)).toBe(100);
    expect(ensureOffersAnchor(200)).toBe(100);
    expect(offersStore.get().anchor).toBe(100);
  });

  it('remembers the music popup and the purchase', () => {
    markMusicOfferShown(42);
    expect(offersStore.get().musicShownAt).toBe(42);
    markMusicPackBought();
    expect(offersStore.get().musicBought).toBe(true);
  });

  it('keeps the 48-hour popup flag for the session only', () => {
    expect(limitedShownThisSession()).toBe(false);
    markLimitedShownThisSession();
    expect(limitedShownThisSession()).toBe(true);
    resetOffers();
    expect(limitedShownThisSession()).toBe(true);
  });
});
