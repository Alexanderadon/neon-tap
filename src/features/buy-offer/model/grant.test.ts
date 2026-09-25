import { describe, expect, it } from 'vitest';
import { SKUS } from '@/shared/lib/iap';
import { addCrystals, creditPaidCrystals, type SaveData } from '@/entities/progress';
import { grantOffer } from './grant';

describe('grantOffer', () => {
  it('credits 300 / 700 / 2 000 / 4 500 crystals for the four packs', () => {
    const credited: number[] = [];
    const deps = { addCrystals: (n: number) => void credited.push(n) };
    expect(grantOffer('crystals-s', deps)).toEqual({ crystals: 300 });
    expect(grantOffer('crystals-m', deps)).toEqual({ crystals: 700 });
    expect(grantOffer('crystals-l', deps)).toEqual({ crystals: 2000 });
    expect(grantOffer('crystals-xl', deps)).toEqual({ crystals: 4500 });
    expect(credited).toEqual([300, 700, 2000, 4500]);
    expect(SKUS).toHaveLength(4);
  });

  it('bought crystals raise the balance, not the lifetime total the badges count', () => {
    let save = addCrystals({ crystals: 0, lifetimeCrystals: 0 } as SaveData, 50);
    grantOffer('crystals-m', { addCrystals: (n) => (save = creditPaidCrystals(save, n)) });
    expect(save).toMatchObject({ crystals: 750, lifetimeCrystals: 50 });
  });
});
