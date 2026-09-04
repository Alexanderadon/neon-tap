import { describe, expect, it } from 'vitest';
import { countJudgements, lanesAt, parseChartLevel, parseSections } from './parseChart';

describe('parseChartLevel', () => {
  it('expands tuples, sorts by time and tags the section lane count', () => {
    const notes = parseChartLevel({ stars: 1, notes: [[1, 2], [0.5, 0, 0.4], [1, 1], [2, 3, 0, 'slow']] });
    expect(notes).toEqual([
      { time: 0.5, lane: 0, duration: 0.4, spell: null, lanes: 4 },
      { time: 1, lane: 1, duration: 0, spell: null, lanes: 4 },
      { time: 1, lane: 2, duration: 0, spell: null, lanes: 4 },
      { time: 2, lane: 3, duration: 0, spell: 'slow', lanes: 4 },
    ]);
    expect(countJudgements(notes)).toBe(5);
  });

  it('resolves lane counts from sections and validates lanes against them', () => {
    const level = { stars: 1, notes: [[0.5, 1], [10, 5], [20, 1]] as [number, number][], sections: [[0, 2], [8, 6], [16, 2]] as [number, number][] };
    const sections = parseSections(level);
    expect(lanesAt(sections, 0)).toBe(2);
    expect(lanesAt(sections, 8)).toBe(6);
    expect(lanesAt(sections, 15.9)).toBe(6);
    expect(lanesAt(sections, 16)).toBe(2);
    const notes = parseChartLevel(level);
    expect(notes.map((n) => n.lanes)).toEqual([2, 6, 2]);
    expect(() => parseChartLevel({ ...level, notes: [[0.5, 3]] })).toThrow(/outside 2-lane/);
  });

  it('rejects invalid lanes, spells and sections', () => {
    expect(() => parseChartLevel({ stars: 1, notes: [[1, 4]] })).toThrow();
    expect(() => parseChartLevel({ stars: 1, notes: [[-1, 0]] })).toThrow();
    expect(() => parseChartLevel({ stars: 1, notes: [[1, 0, 0, 'nope' as 'slow']] })).toThrow();
    expect(() => parseSections({ stars: 1, notes: [], sections: [[0, 7]] })).toThrow();
  });
});
