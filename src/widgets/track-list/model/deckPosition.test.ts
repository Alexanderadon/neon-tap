import { describe, expect, it } from 'vitest';
import { readDeckCard, readLastTrack, writeDeckCard } from './deckPosition';

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

const IDS = ['a', 'b', 'c', 'd'];

describe('deck position', () => {
  it('round-trips every kind of card and forgets a track that left the catalog', () => {
    const s = memory();
    expect(readDeckCard(s, IDS)).toBeNull();
    writeDeckCard(s, { kind: 'track', id: 'c' });
    expect(readDeckCard(s, IDS)).toEqual({ kind: 'track', id: 'c' });
    expect(readDeckCard(s, ['a', 'b'])).toBeNull();
    writeDeckCard(s, { kind: 'custom' });
    expect(readDeckCard(s, IDS)).toEqual({ kind: 'custom' });
    writeDeckCard(s, { kind: 'slot' });
    expect(readDeckCard(s, IDS)).toEqual({ kind: 'slot' });
  });

  it('keeps the last track apart from the card: «Моя музыка» does not forget the track before it', () => {
    const s = memory();
    expect(readLastTrack(s, IDS)).toBeNull();
    writeDeckCard(s, { kind: 'track', id: 'b' });
    writeDeckCard(s, { kind: 'custom' });
    expect(readDeckCard(s, IDS)).toEqual({ kind: 'custom' });
    expect(readLastTrack(s, IDS)).toBe('b');
    writeDeckCard(s, { kind: 'track', id: 'd' });
    expect(readLastTrack(s, IDS)).toBe('d');
    expect(readLastTrack(s, ['a'])).toBeNull();
  });

  it('reads the older format — a catalog index — and rejects garbage', () => {
    const s = memory();
    s.setItem('neon-tap:deck', '2');
    expect(readDeckCard(s, IDS)).toEqual({ kind: 'track', id: 'c' });
    expect(readLastTrack(s, IDS)).toBe('c');
    for (const bad of ['-1', '4', '3.5', 'abc', '']) {
      s.setItem('neon-tap:deck', bad);
      expect(readDeckCard(s, IDS)).toBeNull();
    }
  });

  it('survives a missing or throwing storage', () => {
    expect(readDeckCard(null, IDS)).toBeNull();
    expect(readLastTrack(null, IDS)).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error('quota');
      },
      setItem: () => {
        throw new Error('quota');
      },
    } as unknown as Storage;
    expect(readDeckCard(broken, IDS)).toBeNull();
    expect(readLastTrack(broken, IDS)).toBeNull();
    expect(() => writeDeckCard(broken, { kind: 'track', id: 'a' })).not.toThrow();
  });
});
