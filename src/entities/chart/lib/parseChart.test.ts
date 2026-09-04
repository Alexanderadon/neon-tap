import { describe, expect, it } from 'vitest';
import { countJudgements, parseChartLevel } from './parseChart';

describe('parseChartLevel', () => {
  it('expands tuples and sorts by time', () => {
    const notes = parseChartLevel({ stars: 1, notes: [[1, 2], [0.5, 0, 0.4], [1, 1]] });
    expect(notes).toEqual([
      { time: 0.5, lane: 0, duration: 0.4 },
      { time: 1, lane: 1, duration: 0 },
      { time: 1, lane: 2, duration: 0 },
    ]);
    expect(countJudgements(notes)).toBe(4);
  });

  it('rejects invalid lanes', () => {
    expect(() => parseChartLevel({ stars: 1, notes: [[1, 4]] })).toThrow();
    expect(() => parseChartLevel({ stars: 1, notes: [[-1, 0]] })).toThrow();
  });
});
