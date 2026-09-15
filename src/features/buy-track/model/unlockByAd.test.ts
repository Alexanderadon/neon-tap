import { describe, expect, it } from 'vitest';
import type { AdOutcome } from '@/shared/lib/ads';
import { emptySave } from '@/entities/progress/model/SaveData';
import { purchaseTrack } from '@/entities/progress/model/shop';
import { watchAdForTrack } from './unlockByAd';

function harness(outcome: AdOutcome, purchased: string[] = []) {
  let save = { ...emptySave(), purchased };
  const shown: string[] = [];
  const deps = {
    ads: {
      show: (placement: string) => {
        shown.push(placement);
        return Promise.resolve(outcome);
      },
    },
    unlock: (id: string) => {
      const r = purchaseTrack(save, id, 0);
      save = r.save;
      return r.ok;
    },
  };
  return { deps, shown, save: () => save };
}

describe('watchAdForTrack', () => {
  it('unlocks the track only when the ad is rewarded, persisting it exactly like a purchase (price 0)', async () => {
    const h = harness('rewarded');
    await expect(watchAdForTrack('t7', h.deps)).resolves.toEqual({ outcome: 'rewarded', unlocked: true });
    expect(h.shown).toEqual(['shop-track']);
    expect(h.save().purchased).toEqual(['t7']);
    expect(h.save().crystals).toBe(0);
  });

  it('grants nothing when the ad is closed early or fails', async () => {
    for (const outcome of ['closed', 'failed'] as const) {
      const h = harness(outcome);
      await expect(watchAdForTrack('t7', h.deps)).resolves.toEqual({ outcome, unlocked: false });
      expect(h.save().purchased).toEqual([]);
    }
  });

  it('reports unlocked: false for a track owned before the ad (no duplicate entry)', async () => {
    const h = harness('rewarded', ['t7']);
    await expect(watchAdForTrack('t7', h.deps)).resolves.toEqual({ outcome: 'rewarded', unlocked: false });
    expect(h.save().purchased).toEqual(['t7']);
  });
});
