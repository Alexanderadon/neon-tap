import { describe, expect, it } from 'vitest';
import { readDeckIndex, writeDeckIndex } from './deckPosition';

function memory(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    length: 0,
  };
}

describe('deck position', () => {
  it('round-trips a valid index and rejects anything outside the catalog', () => {
    const s = memory();
    expect(readDeckIndex(s, 59)).toBeNull();
    writeDeckIndex(s, 17);
    expect(readDeckIndex(s, 59)).toBe(17);
    expect(readDeckIndex(s, 10)).toBeNull(); // catalog shrank
    s.setItem('neon-tap:deck', '-1');
    expect(readDeckIndex(s, 59)).toBeNull();
    s.setItem('neon-tap:deck', 'abc');
    expect(readDeckIndex(s, 59)).toBeNull();
    s.setItem('neon-tap:deck', '3.5');
    expect(readDeckIndex(s, 59)).toBeNull();
  });

  it('survives a missing or throwing storage', () => {
    expect(readDeckIndex(null, 59)).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error('quota');
      },
    } as unknown as Storage;
    expect(readDeckIndex(broken, 59)).toBeNull();
    expect(() =>
      writeDeckIndex(
        {
          setItem: () => {
            throw new Error('quota');
          },
        } as unknown as Storage,
        1,
      ),
    ).not.toThrow();
  });
});
