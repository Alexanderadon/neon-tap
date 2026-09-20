import { describe, expect, it } from 'vitest';
import type { NoteTuple } from '@/shared/types/chart';
import { beatSeconds, songMap } from './songMap';

/** 120 BPM: a phrase of 16 beats is 8 s. `perPhrase[p]` taps in phrase p, a quarter second apart. */
function chartWith(perPhrase: number[], bpm = 120): { chart: { notes: NoteTuple[] }; bpm: number; offset: number } {
  const notes: NoteTuple[] = [];
  const phraseSec = (60 / bpm) * 16;
  perPhrase.forEach((count, p) => {
    for (let k = 0; k < count; k++) notes.push([p * phraseSec + k * 0.25, k % 3]);
  });
  return { chart: { notes }, bpm, offset: 0 };
}

describe('songMap', () => {
  it('rates each phrase by its hit density: the densest quarter is the drop, the sparsest the quiet part', () => {
    const map = songMap(chartWith([0, 1, 2, 2, 8, 8, 2, 1]), 64);
    expect(map.map((s) => s.level)).toEqual([0, 0, 1, 1, 2, 2, 1, 0]);
    expect(map.map((s) => s.from)).toEqual([0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]);
  });

  it('lays the phrases out over the run length it is given, not the file length', () => {
    const map = songMap(chartWith([1, 2, 4, 2, 1, 8, 8, 8]), 40);
    expect(map).toHaveLength(5);
    expect(map[4].from).toBe(0.8);
    expect(map.map((s) => s.level)).toEqual([0, 1, 2, 1, 0]);
  });

  it('counts a drum roll by its taps', () => {
    const chart = chartWith([1, 1, 1, 1]);
    chart.chart.notes.push([8.5, 1, 1, 'roll', 6]);
    expect(songMap(chart, 32).map((s) => s.level)).toEqual([0, 2, 0, 0]);
  });

  it('is one plain segment for a flat song, a song without a grid or one too short for three phrases', () => {
    const flat = [{ from: 0, level: 1 }];
    expect(songMap(chartWith([3, 3, 3, 3]), 32)).toEqual(flat);
    expect(songMap({ chart: { notes: [[1, 0]] }, bpm: 0, offset: 0 }, 60)).toEqual(flat);
    expect(songMap(chartWith([1, 5]), 16)).toEqual(flat);
    expect(songMap(chartWith([1, 5, 9]), 0)).toEqual(flat);
  });

  it('takes the beat grid over the tempo when the chart has one', () => {
    const chart = { ...chartWith([1, 1, 9, 1]), beats: Array.from({ length: 64 }, (_, i) => i * 0.4) };
    expect(beatSeconds(chart)).toBeCloseTo(0.4);
    const from = songMap(chart, 25.6).map((s) => s.from);
    expect(from).toHaveLength(4);
    [0, 0.25, 0.5, 0.75].forEach((v, i) => expect(from[i]).toBeCloseTo(v));
    expect(beatSeconds({ bpm: 100 })).toBe(0.6);
  });
});
