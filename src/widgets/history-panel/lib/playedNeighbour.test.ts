import { describe, expect, it } from 'vitest';
import { playedNeighbour } from './playedNeighbour';

const IDS = ['a', 'b', 'c', 'd', 'e'];

describe('records arrows', () => {
  it('step through the played tracks only, in deck order, and stop at the ends', () => {
    const played = new Set(['b', 'd']);
    expect(playedNeighbour(IDS, played, 'b', 1)).toBe('d');
    expect(playedNeighbour(IDS, played, 'd', -1)).toBe('b');
    expect(playedNeighbour(IDS, played, 'b', -1)).toBeNull();
    expect(playedNeighbour(IDS, played, 'd', 1)).toBeNull();
  });

  it('lead from an unplayed track to the nearest played one on that side', () => {
    const played = new Set(['a', 'e']);
    expect(playedNeighbour(IDS, played, 'c', -1)).toBe('a');
    expect(playedNeighbour(IDS, played, 'c', 1)).toBe('e');
    expect(playedNeighbour(IDS, new Set(), 'c', 1)).toBeNull();
  });

  it('treat an unknown id as before the first card', () => {
    expect(playedNeighbour(IDS, new Set(['a']), 'zz', 1)).toBe('a');
    expect(playedNeighbour(IDS, new Set(['a']), 'zz', -1)).toBeNull();
  });
});
