import { describe, expect, it } from 'vitest';
import { previousBest } from './previousBest';

describe('previousBest', () => {
  it('ignores the current run (index 0) and failed attempts', () => {
    expect(
      previousBest([
        { score: 102400, failed: false },
        { score: 120000, failed: true },
        { score: 98200, failed: false },
        { score: 70000, failed: false },
      ]),
    ).toBe(98200);
  });

  it('is null on the first run or when only failed attempts came before', () => {
    expect(previousBest([])).toBeNull();
    expect(previousBest([{ score: 1000, failed: false }])).toBeNull();
    expect(
      previousBest([
        { score: 1000, failed: false },
        { score: 500, failed: true },
      ]),
    ).toBeNull();
  });
});
