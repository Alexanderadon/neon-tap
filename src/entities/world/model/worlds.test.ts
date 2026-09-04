import { describe, expect, it } from 'vitest';
import { UNLOCK_ALL_WORLDS } from '@/shared/config/constants';
import { WORLDS, isWorldUnlocked, nextLockedWorld } from './worlds';

describe('worlds', () => {
  it('has four worlds with ascending star thresholds', () => {
    expect(WORLDS.map((w) => w.requiredStars)).toEqual([0, 8, 20, 38]);
  });

  it('respects the UNLOCK_ALL_WORLDS switch', () => {
    const core = WORLDS[3];
    if (UNLOCK_ALL_WORLDS) {
      expect(isWorldUnlocked(core, 0)).toBe(true);
      expect(nextLockedWorld(0)).toBeNull();
    } else {
      expect(isWorldUnlocked(core, 37)).toBe(false);
      expect(isWorldUnlocked(core, 38)).toBe(true);
      expect(nextLockedWorld(10)?.id).toBe('overload');
    }
  });
});
