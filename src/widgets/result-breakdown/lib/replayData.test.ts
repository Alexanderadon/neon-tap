import { describe, expect, it } from 'vitest';
import { parseChartLevel, parseSections } from '@/entities/chart';
import type { ResultTimeline } from '@/entities/score';
import { buildReplay, replayLanesAt, REPLAY_APPROACH } from './replayData';

const level = {
  stars: 3,
  sections: [
    [0, 4],
    [6, 5],
  ] as [number, number][],
  notes: [
    [1, 0],
    [2, 1, 1],
    [3.5, 2],
    [5, 3],
    [7, 4, 1, 'slide', 3],
    [8, 0, 0, 'circle'],
    [20, 1],
  ],
};
const notes = parseChartLevel(level as Parameters<typeof parseChartLevel>[0]);
const sections = parseSections(level as Parameters<typeof parseSections>[0]);

const timeline: ResultTimeline = {
  t: [1.02, 2.05, 3.0, 3.6, 5.15, 7.1, 8.0, 8.2, 20.1],
  j: ['perfect', 'great', 'perfect', 'good', 'miss', 'perfect', 'perfect', 'great', 'perfect'],
  combo: [1, 2, 3, 4, 0, 1, 2, 3, 4],
};

describe('buildReplay', () => {
  it('keeps the notes visible inside the range and attaches judgements to heads and tails', () => {
    const d = buildReplay(notes, sections, timeline, { from: 2.5, to: 9 });
    // note at 1 is gone (1 + 0 < 2.5 - approach), note at 20 is outside the range
    expect(d.noteCount).toBe(5);
    expect(Array.from(d.noteTime)).toEqual([2, 3.5, 5, 7, 8]);
    expect(d.noteHit[0]).toBe(2.05);
    expect(d.noteTailHit[0]).toBe(3.0);
    expect(d.noteHit[1]).toBe(3.6);
    expect(d.noteHit[2]).toBe(5.15); // the miss is still a recorded judgement of that note
    expect(d.noteHit[3]).toBe(7.1);
    expect(d.noteTailHit[3]).toBe(8.0);
    expect(d.noteHit[4]).toBe(8.2);
    expect(d.noteCircle[4]).toBe(1);
  });

  it('flashes land in the note lane; slide tails flash in the end lane; unmatched events get lane -1', () => {
    const d = buildReplay(notes, sections, timeline, { from: 2.5, to: 9 });
    expect(d.eventCount).toBe(7);
    expect(Array.from(d.eventLane)).toEqual([1, 1, 2, 3, 4, 3, 0]);
    expect(Array.from(d.eventLanes)).toEqual([4, 4, 4, 4, 5, 5, 5]);
    expect(Array.from(d.eventCode)).toEqual([1, 0, 2, 3, 0, 0, 1]);
    const stray = buildReplay(notes, sections, { t: [4.4], j: ['perfect'], combo: [1] }, { from: 2.5, to: 9 });
    expect(stray.eventCount).toBe(1);
    expect(stray.eventLane[0]).toBe(-1);
  });

  it('exposes lane counts and section geometry', () => {
    const d = buildReplay(notes, sections, timeline, { from: 2.5, to: 9 });
    expect(d.laneCounts).toEqual([4, 5]);
    expect(replayLanesAt(d, 0)).toBe(4);
    expect(replayLanesAt(d, 6)).toBe(5);
    expect(replayLanesAt(d, 100)).toBe(5);
  });

  it('handles an empty range gracefully', () => {
    const d = buildReplay(notes, sections, timeline, { from: 30, to: 38 });
    expect(d.noteCount).toBe(0);
    expect(d.eventCount).toBe(0);
    expect(d.laneCounts).toEqual([4]);
    expect(REPLAY_APPROACH).toBeGreaterThan(0);
  });
});
