import { describe, expect, it } from 'vitest';
import { CATALOG } from '@/entities/track';
import { CUSTOM_CARD, DECK_SIZE, SLOT_CARD, SLOT_WEEK, deckLayout, isCustomCard, isSlotCard, slotCoverId, trackIndexOf } from './deckCards';
import { readDeckIndex } from './deckPosition';
import { releaseTarget, rubberBand } from './deckMotion';

describe('the deck layout', () => {
  it('puts the empty-week card after the tracks and the custom card last', () => {
    expect(deckLayout(44, 3)).toEqual({ slotCard: 44, customCard: 45, size: 46 });
    expect(deckLayout(44, null)).toEqual({ slotCard: -1, customCard: 44, size: 45 });
  });

  it('matches the built-in deck: tracks, the empty week while there is one, the custom card', () => {
    expect(SLOT_CARD).toBe(SLOT_WEEK === null ? -1 : CATALOG.length);
    expect(CUSTOM_CARD).toBe(CATALOG.length + (SLOT_WEEK === null ? 0 : 1));
    expect(DECK_SIZE).toBe(CUSTOM_CARD + 1);
    expect(isSlotCard(CATALOG.length - 1)).toBe(false);
    expect(isSlotCard(-1)).toBe(false);
    if (SLOT_WEEK !== null) expect(isSlotCard(SLOT_CARD)).toBe(true);
  });

  it('seeds the empty-week cover by the week', () => {
    expect(slotCoverId(4)).toBe('drop-week-4');
  });
});

describe('the custom card', () => {
  it('is the last card', () => {
    expect(isCustomCard(CUSTOM_CARD)).toBe(true);
    expect(isCustomCard(CATALOG.length - 1)).toBe(false);
    expect(isCustomCard(DECK_SIZE - 1)).toBe(true);
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

  it('is never where the deck reopens, nor is the empty-week card', () => {
    expect(readDeckIndex({ getItem: () => String(CUSTOM_CARD) }, CATALOG.length)).toBeNull();
    expect(readDeckIndex({ getItem: () => String(CATALOG.length) }, CATALOG.length)).toBeNull();
  });
});
