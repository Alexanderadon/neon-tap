import { describe, expect, it } from 'vitest';
import { CATALOG } from '@/entities/track';
import { emptySave } from '@/entities/progress/model/SaveData';
import { CUSTOM_CARD, SLOT_CARD } from './deckCards';
import { writeDeckCard } from './deckPosition';
import { markDropSeen, unseenDrop } from './dropSeen';
import { initialDeckIndex, initialTrackIndex, startIndex } from './deckStart';
import { buildCatalogState } from './useCatalogState';

function memory(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size;
    },
  };
}

const state = buildCatalogState(emptySave());

/** A storage where this week's new track (if any) was already shown, so the remembered card decides. */
function seen(): Storage {
  const s = memory();
  const fresh = unseenDrop(CATALOG, state, s);
  if (fresh) markDropSeen(s, fresh.id);
  return s;
}

describe('where the deck opens', () => {
  it('on the card it was left on — «Моя музыка» too — so a trip to the shop never lands on another track', () => {
    const s = seen();
    expect(initialDeckIndex(state, s)).toBe(startIndex(state));
    writeDeckCard(s, { kind: 'track', id: CATALOG[5].id });
    expect(initialDeckIndex(state, s)).toBe(5);
    writeDeckCard(s, { kind: 'custom' });
    expect(initialDeckIndex(state, s)).toBe(CUSTOM_CARD);
    writeDeckCard(s, { kind: 'slot' });
    expect(initialDeckIndex(state, s)).toBe(SLOT_CARD >= 0 ? SLOT_CARD : startIndex(state));
  });

  it('stands for the last chosen track on a card without one, else the start track', () => {
    const s = seen();
    expect(initialTrackIndex(state, s, CUSTOM_CARD)).toBe(startIndex(state));
    writeDeckCard(s, { kind: 'track', id: CATALOG[7].id });
    writeDeckCard(s, { kind: 'custom' });
    expect(initialTrackIndex(state, s, CUSTOM_CARD)).toBe(7);
    expect(initialTrackIndex(state, s, 3)).toBe(3);
  });
});
