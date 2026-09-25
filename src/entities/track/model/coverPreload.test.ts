import { describe, expect, it } from 'vitest';
import { idsAround } from './coverPreload';

describe('idsAround', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];

  it('orders the cards by distance from the focused one', () => {
    expect(idsAround(ids, 2, 2)).toEqual(['c', 'd', 'b', 'e', 'a']);
    expect(idsAround(ids, 2, 1)).toEqual(['c', 'd', 'b']);
  });

  it('stops at the ends of the deck', () => {
    expect(idsAround(ids, 0, 2)).toEqual(['a', 'b', 'c']);
    expect(idsAround(ids, 4, ids.length)).toEqual(['e', 'd', 'c', 'b', 'a']);
    expect(idsAround(ids, 9, 2)).toEqual([]);
  });
});
