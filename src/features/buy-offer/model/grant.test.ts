import { describe, expect, it, vi } from 'vitest';
import { grantOffer, type GrantDeps } from './grant';

function deps(owned: string[] = []): GrantDeps & { owned: string[]; credited: number[] } {
  const credited: number[] = [];
  const d = {
    owned: [...owned],
    credited,
    addCrystals: (n: number) => {
      credited.push(n);
    },
    unlockTrack: (id: string) => {
      if (d.owned.includes(id)) return false;
      d.owned.push(id);
      return true;
    },
    packIds: ['p1', 'p2', 'a9'],
    markMusicBought: vi.fn(),
  };
  return d;
}

describe('grantOffer', () => {
  it('credits the crystals of a pack and of the deal', () => {
    const d = deps();
    expect(grantOffer('crystals-s', d)).toEqual({ crystals: 500, tracks: [] });
    expect(grantOffer('crystals-m', d)).toEqual({ crystals: 1500, tracks: [] });
    expect(grantOffer('crystals-l', d)).toEqual({ crystals: 4000, tracks: [] });
    expect(grantOffer('limited-48h', d)).toEqual({ crystals: 3000, tracks: [] });
    expect(d.credited).toEqual([500, 1500, 4000, 3000]);
    expect(d.markMusicBought).not.toHaveBeenCalled();
  });

  it('unlocks the whole music pack and marks it bought', () => {
    const d = deps();
    expect(grantOffer('music-8', d)).toEqual({ crystals: 0, tracks: ['p1', 'p2', 'a9'] });
    expect(d.owned).toEqual(['p1', 'p2', 'a9']);
    expect(d.credited).toEqual([]);
    expect(d.markMusicBought).toHaveBeenCalledTimes(1);
  });

  it('is idempotent for the music pack: owned tracks stay owned once', () => {
    const d = deps(['p1']);
    expect(grantOffer('music-8', d).tracks).toEqual(['p2', 'a9']);
    expect(grantOffer('music-8', d).tracks).toEqual([]);
    expect(d.owned).toEqual(['p1', 'p2', 'a9']);
  });
});
