import { describe, expect, it } from 'vitest';
import { arrivedSince, readSeenCrystals, writeSeenCrystals } from './seenCrystals';

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}

describe('seenCrystals', () => {
  it('round-trips the balance and ignores garbage', () => {
    const s = memoryStorage();
    expect(readSeenCrystals(s)).toBeNull();
    writeSeenCrystals(s, 158.7);
    expect(readSeenCrystals(s)).toBe(158);
    expect(readSeenCrystals(memoryStorage({ 'neon-tap:shop-seen': 'abc' }))).toBeNull();
    expect(readSeenCrystals(memoryStorage({ 'neon-tap:shop-seen': '-3' }))).toBeNull();
    expect(readSeenCrystals(null)).toBeNull();
  });

  it('survives a throwing storage', () => {
    const broken = {
      getItem: () => {
        throw new Error('quota');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(readSeenCrystals(broken)).toBeNull();
    expect(() => writeSeenCrystals(broken, 5)).not.toThrow();
  });

  it('counts only crystals that arrived: nothing on the first visit or after spending', () => {
    expect(arrivedSince(null, 758)).toBe(0);
    expect(arrivedSince(158, 243)).toBe(85);
    expect(arrivedSince(758, 585)).toBe(0);
  });
});
