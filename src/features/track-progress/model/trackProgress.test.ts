import { beforeEach, describe, expect, it } from 'vitest';
import { progressStore, resetProgress } from '@/entities/progress';
import { trackSpell } from './trackProgress';

describe('trackSpell', () => {
  beforeEach(() => resetProgress());

  it('counts caught spells by kind in the save', () => {
    trackSpell('slow');
    trackSpell('heart');
    trackSpell('slow');
    expect(progressStore.get().counters.spells).toEqual({ slow: 2, heart: 1 });
  });
});
