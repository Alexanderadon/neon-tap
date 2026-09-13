import { describe, expect, it } from 'vitest';
import { EditorDraft, Recorder } from './Recorder';
import { snapToGrid, type NoteTuple, type Section } from '@/entities/chart';

/** 120 BPM grid: a beat every 0.5 s, sixteenths every 0.125 s, from 1.0 s. */
const beats = Array.from({ length: 64 }, (_, i) => 1 + i * 0.5);
const four: Section[] = [{ time: 0, lanes: 4 }];

describe('snapToGrid', () => {
  it('snaps to the nearest sixteenth of the tracked grid, extrapolating before the first beat', () => {
    expect(snapToGrid(beats, 1.0)).toEqual({ slot: 0, time: 1 });
    expect(snapToGrid(beats, 1.31)).toEqual({ slot: 2, time: 1.25 });
    expect(snapToGrid(beats, 1.44)).toEqual({ slot: 4, time: 1.5 });
    expect(snapToGrid(beats, 0.63)).toEqual({ slot: -3, time: 0.625 });
  });
});

describe('Recorder', () => {
  it('turns a tap into a tile on the grid, a held press into a hold ending on the grid', () => {
    const r = new Recorder(beats, four);
    r.press(1, 2.03);
    expect(r.release(1, 2.09)).toEqual([2, 1]);
    r.press(2, 3.02);
    expect(r.release(2, 3.71)).toEqual([3, 2, 0.75]);
    expect(r.recorded).toEqual([
      [2, 1],
      [3, 2, 0.75],
    ]);
  });

  it('makes a chord of two lanes on one slot and ignores a repeat on the same lane and slot', () => {
    const r = new Recorder(beats, four);
    r.press(0, 2.0);
    r.press(3, 2.02);
    r.release(0, 2.05);
    r.release(3, 2.06);
    r.press(0, 2.04);
    expect(r.release(0, 2.1)).toBeNull();
    expect(r.recorded).toEqual([
      [2, 0],
      [2, 3],
    ]);
  });

  it('ignores lanes outside the section and commits fingers still down as taps', () => {
    const r = new Recorder(beats, [
      { time: 0, lanes: 2 },
      { time: 10, lanes: 4 },
    ]);
    r.press(3, 2.0);
    expect(r.release(3, 2.1)).toBeNull();
    r.press(3, 12.0);
    r.press(1, 12.5);
    r.releaseAll();
    expect(r.recorded).toEqual([
      [12, 3],
      [12.5, 1],
    ]);
    expect(r.release(1, 13)).toBeNull();
  });
});

describe('EditorDraft', () => {
  const base: NoteTuple[] = [
    [1, 0],
    [2, 1],
    [3, 2, 0.5],
    [4, 3],
  ];

  it('replaces only the notes inside the recorded range and keeps the rest, in order', () => {
    const d = new EditorDraft([...base]);
    d.replaceRange(2, 4, [
      [2.5, 0],
      [3, 1],
      [4.5, 2], // outside the range: dropped
    ]);
    expect(d.notes).toEqual([
      [1, 0],
      [2.5, 0],
      [3, 1],
      [4, 3],
    ]);
  });

  it('undoes replacements and clears', () => {
    const d = new EditorDraft([...base]);
    d.clearRange(0, 10);
    expect(d.notes).toEqual([]);
    expect(d.canUndo).toBe(true);
    expect(d.undo()).toBe(true);
    expect(d.notes).toEqual(base);
    expect(d.undo()).toBe(false);
  });
});
