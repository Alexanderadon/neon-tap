import { describe, expect, it } from 'vitest';
import { chapterAt, chaptersOf, chapterTitle } from './chapters';

const main = (n: number) => Array.from({ length: n }, () => ({}));
const pack = (id: string, n: number) => Array.from({ length: n }, () => ({ pack: id }));

describe('chaptersOf', () => {
  it('cuts the main catalog into numbered chapters of ten', () => {
    expect(chaptersOf(main(23))).toEqual([
      { start: 0, end: 10, number: 1 },
      { start: 10, end: 20, number: 2 },
      { start: 20, end: 23, number: 3 },
    ]);
  });

  it('gives a pack a chapter of its own after the numbered ones, whatever its size', () => {
    expect(chaptersOf([...main(12), ...pack('rock', 3)])).toEqual([
      { start: 0, end: 10, number: 1 },
      { start: 10, end: 12, number: 2 },
      { start: 12, end: 15, pack: 'rock' },
    ]);
  });

  it('keeps packs apart and cuts a long pack by ten', () => {
    const chapters = chaptersOf([...main(4), ...pack('rock', 12), ...pack('jazz', 2)]);
    expect(chapters.map((c) => [c.start, c.end, c.pack ?? c.number])).toEqual([
      [0, 4, 1],
      [4, 14, 'rock'],
      [14, 16, 'rock'],
      [16, 18, 'jazz'],
    ]);
  });

  it('finds the chapter of a position and titles it', () => {
    const chapters = chaptersOf([...main(12), ...pack('rock', 3)]);
    expect(chapterAt(11, chapters)).toEqual({ start: 10, end: 12, number: 2 });
    expect(chapterAt(14, chapters)?.pack).toBe('rock');
    expect(chapterAt(15, chapters)).toBeUndefined();
    expect(chapterTitle(chapters[1])).toBe('Глава 2');
    expect(chapterTitle(chapters[2])).toBe('Рок-пак');
    expect(chapterTitle({ start: 0, end: 1, pack: 'unknown' })).toBe('unknown');
  });

  it('is empty for an empty catalog', () => {
    expect(chaptersOf([])).toEqual([]);
  });

  it('gives the premium tracks a chapter of their own instead of a short numbered one', () => {
    const premium = (n: number) => Array.from({ length: n }, () => ({ premium: true }));
    // The built-in layout: 36 road tracks, 5 premium, the rock pack.
    const chapters = chaptersOf([...main(36), ...premium(5), ...pack('rock', 3)]);
    expect(chapters.map((c) => [c.start, c.end, c.kind ?? c.pack ?? c.number])).toEqual([
      [0, 10, 1],
      [10, 20, 2],
      [20, 30, 3],
      [30, 36, 4],
      [36, 41, 'premium'],
      [41, 44, 'rock'],
    ]);
    expect(chapterTitle(chapters[4])).toBe('Премиум');
  });

  it('puts the weekly tracks in «Новинки» after the rock pack, cut by ten', () => {
    const drop = (n: number) => Array.from({ length: n }, () => ({ drop: true }));
    const chapters = chaptersOf([...main(3), ...pack('rock', 2), ...drop(13)]);
    expect(chapters.map((c) => [c.start, c.end, c.kind ?? c.pack ?? c.number])).toEqual([
      [0, 3, 1],
      [3, 5, 'rock'],
      [5, 15, 'drops'],
      [15, 18, 'drops'],
    ]);
    expect(chapterTitle(chapters[2])).toBe('Новинки');
    expect(chapters[2].pack).toBeUndefined();
  });
});
