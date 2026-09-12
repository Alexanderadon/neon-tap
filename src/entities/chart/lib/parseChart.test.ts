import { describe, expect, it } from 'vitest';
import { countJudgements, lanesAt, parseChartLevel, parseSections } from './parseChart';
import type { ChartLevel } from '../model/types';

describe('parseChartLevel', () => {
  it('expands tuples, sorts by time and tags the section lane count', () => {
    const notes = parseChartLevel({
      stars: 1,
      notes: [
        [1, 2],
        [0.5, 0, 0.4],
        [1, 1],
        [2, 3, 0, 'slow'],
      ],
    });
    expect(notes).toEqual([
      { time: 0.5, lane: 0, duration: 0.4, kind: null, seq: 0, extra: 0, lanes: 4, pitch: 0 },
      { time: 1, lane: 1, duration: 0, kind: null, seq: 0, extra: 0, lanes: 4, pitch: 0 },
      { time: 1, lane: 2, duration: 0, kind: null, seq: 0, extra: 0, lanes: 4, pitch: 0 },
      { time: 2, lane: 3, duration: 0, kind: 'slow', seq: 0, extra: 0, lanes: 4, pitch: 0 },
    ]);
    expect(countJudgements(notes)).toBe(5);
  });

  it('parses rolls and slides with their extra value', () => {
    const notes = parseChartLevel({
      stars: 1,
      notes: [
        [1, 0, 0.5, 'roll', 4],
        [2, 1, 1, 'slide', 3],
      ],
    });
    expect(notes[0]).toMatchObject({ kind: 'roll', extra: 4, duration: 0.5 });
    expect(notes[1]).toMatchObject({ kind: 'slide', extra: 3, duration: 1 });
    expect(() => parseChartLevel({ stars: 1, notes: [[1, 0, 0, 'roll', 4]] })).toThrow(/roll/);
    expect(() => parseChartLevel({ stars: 1, notes: [[1, 0, 1, 'slide', 0]] })).toThrow(/slide/);
    expect(() => parseChartLevel({ stars: 1, notes: [[1, 0, 1, 'slide', 4]] })).toThrow(/slide/);
  });

  it('numbers circle groups 1, 2, 3 and restarts after a gap', () => {
    const notes = parseChartLevel({
      stars: 1,
      notes: [
        [1, 0, 0, 'circle'],
        [1.5, 2, 0, 'circle'],
        [2, 1, 0, 'circle'],
        [10, 3, 0, 'circle'],
        [10.5, 0, 0, 'circle'],
      ],
    });
    expect(notes.map((n) => n.seq)).toEqual([1, 2, 3, 1, 2]);
  });

  it('resolves lane counts from sections and validates lanes against them', () => {
    const level = {
      stars: 1,
      notes: [
        [0.5, 1],
        [10, 5],
        [20, 1],
      ] as [number, number][],
      sections: [
        [0, 2],
        [8, 6],
        [16, 2],
      ] as [number, number][],
    };
    const sections = parseSections(level);
    expect(lanesAt(sections, 0)).toBe(2);
    expect(lanesAt(sections, 8)).toBe(6);
    expect(lanesAt(sections, 16)).toBe(2);
    expect(parseChartLevel(level).map((n) => n.lanes)).toEqual([2, 6, 2]);
    expect(() => parseChartLevel({ ...level, notes: [[0.5, 3]] })).toThrow(/outside 2-lane/);
  });

  it('accepts single-lane sections: taps, holds and rolls in lane 0, but no slides (nowhere to go)', () => {
    const level: ChartLevel = {
      stars: 1,
      notes: [
        [1, 0],
        [2, 0, 1],
        [4, 0, 1, 'roll', 3],
        [9, 2],
      ],
      sections: [
        [0, 1],
        [8, 3],
      ],
    };
    const sections = parseSections(level);
    expect(sections).toEqual([
      { time: 0, lanes: 1 },
      { time: 8, lanes: 3 },
    ]);
    expect(lanesAt(sections, 7.9)).toBe(1);
    const notes = parseChartLevel(level);
    expect(notes.map((n) => n.lanes)).toEqual([1, 1, 1, 3]);
    expect(() => parseChartLevel({ ...level, notes: [[1, 1]] })).toThrow(/outside 1-lane/);
    expect(() => parseChartLevel({ ...level, notes: [[1, 0, 1, 'slide', 1]] })).toThrow(/slide/);
    expect(() => parseSections({ stars: 1, notes: [], sections: [[0, 0]] })).toThrow(/bad lane count/);
  });

  it('rejects invalid lanes, kinds, hold-specials and sections', () => {
    expect(() => parseChartLevel({ stars: 1, notes: [[1, 4]] })).toThrow();
    expect(() => parseChartLevel({ stars: 1, notes: [[-1, 0]] })).toThrow();
    expect(() => parseChartLevel({ stars: 1, notes: [[1, 0, 0, 'nope' as 'slow']] })).toThrow();
    expect(() => parseChartLevel({ stars: 1, notes: [[1, 0, 0.5, 'circle']] })).toThrow(/cannot be a hold/);
    expect(() => parseSections({ stars: 1, notes: [], sections: [[0, 7]] })).toThrow();
  });
});

describe('pitches', () => {
  it('carries the melody note of every tile and rejects nonsense', () => {
    const level = { stars: 1, notes: [[1, 0] as [number, number], [2, 1] as [number, number]], pitches: [60, 0] };
    expect(parseChartLevel(level).map((n) => n.pitch)).toEqual([60, 0]);
    expect(parseChartLevel({ stars: 1, notes: [[1, 0]] }).map((n) => n.pitch)).toEqual([0]);
    expect(() => parseChartLevel({ stars: 1, notes: [[1, 0]], pitches: [200] })).toThrow(/pitch/);
  });
});
