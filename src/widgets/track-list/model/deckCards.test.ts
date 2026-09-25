import { describe, expect, it } from 'vitest';
import { CATALOG } from '@/entities/track';
import { CUSTOM_CARD, DECK_SIZE, isCustomCard, trackIndexOf } from './deckCards';
import { readDeckIndex } from './deckPosition';
import { releaseTarget, rubberBand } from './deckMotion';

describe('the custom card', () => {
  it('is the last card, right after the last track', () => {
    expect(CUSTOM_CARD).toBe(CATALOG.length);
    expect(DECK_SIZE).toBe(CATALOG.length + 1);
    expect(isCustomCard(CUSTOM_CARD)).toBe(true);
    expect(isCustomCard(CATALOG.length - 1)).toBe(false);
  });

  it('stands for the last track where a track is needed; indices clamp into the catalog', () => {
    expect(trackIndexOf(CUSTOM_CARD)).toBe(CATALOG.length - 1);
    expect(trackIndexOf(3)).toBe(3);
    expect(trackIndexOf(-2)).toBe(0);
  });

  it('is reachable by a swipe and the rubber band starts past it', () => {
    expect(releaseTarget(CUSTOM_CARD - 1, CUSTOM_CARD - 0.4, -120, 0, DECK_SIZE)).toBe(CUSTOM_CARD);
    expect(releaseTarget(CUSTOM_CARD, CUSTOM_CARD + 0.4, -200, -3, DECK_SIZE)).toBe(CUSTOM_CARD);
    expect(rubberBand(CUSTOM_CARD, DECK_SIZE)).toBe(CUSTOM_CARD);
    expect(rubberBand(CUSTOM_CARD + 0.9, DECK_SIZE)).toBeCloseTo(CUSTOM_CARD + 0.3);
  });

  it('is never where the deck reopens', () => {
    const storage = { getItem: () => String(CUSTOM_CARD) };
    expect(readDeckIndex(storage, CATALOG.length)).toBeNull();
  });
});
