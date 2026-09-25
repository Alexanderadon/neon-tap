import { describe, expect, it } from 'vitest';
import type { ChartFile } from '@/shared/types/chart';
import { isCustomId } from '@/shared/types/chart';
import type { PlayResult } from '@/shared/types/result';
import { TITLE_MAX, bestOfRun, cleanTitle, mergeBest, newSong, renamedMeta, songIdOf, songKey, songLengthProblem, songTitle, titleFromFileName } from './song';

const chart: ChartFile = {
  id: 'custom:old',
  title: 'old',
  artist: '',
  license: 'user file (local only)',
  sourceUrl: '',
  audio: '',
  bpm: 127.6,
  offset: 0.2,
  duration: 183.27,
  chart: {
    stars: 4,
    notes: [
      [1, 0],
      [2, 1],
      [3, 2],
    ],
  },
};

describe('song id', () => {
  it('is custom: + 20 hex of the fingerprint, the same for the same bytes', async () => {
    const bytes = new Uint8Array(1000).map((_, i) => i * 7);
    const a = await songIdOf(new Blob([bytes]));
    const b = await songIdOf(new File([bytes], 'renamed.mp3'));
    expect(a).toMatch(/^custom:[0-9a-f]{20}$/);
    expect(a).toBe(b);
    expect(isCustomId(a)).toBe(true);
    expect(await songIdOf(new Blob([bytes, new Uint8Array(1)]))).not.toBe(a);
  });
});

describe('titles', () => {
  it('keys the search: lower case, ё → е, single spaces', () => {
    expect(songKey('  Ёжик   в ТУМАНЕ ')).toBe('ежик в тумане');
  });

  it('cleans a title to one line of 60 characters', () => {
    expect(cleanTitle(' a\tb\nc ')).toBe('a b c');
    expect(cleanTitle('я'.repeat(80))).toHaveLength(TITLE_MAX);
    expect(Array.from(cleanTitle('😀'.repeat(70)))).toHaveLength(TITLE_MAX); // never splits a surrogate pair
    expect(cleanTitle(undefined)).toBe('');
  });

  it('prefers the tags and falls back to the file name', () => {
    expect(songTitle({ title: 'Кукушка', artist: 'Кино' }, 'track01.mp3')).toEqual({ title: 'Кукушка', artist: 'Кино' });
    expect(songTitle({}, '01_my_song.mp3')).toEqual({ title: '01 my song', artist: '' });
    expect(songTitle({ title: '   ' }, 'Песня.flac')).toEqual({ title: 'Песня', artist: '' });
    expect(titleFromFileName('no-extension')).toBe('no-extension');
    expect(titleFromFileName('.mp3')).toBe('.mp3');
  });

  it('renames: new title and key, blank refused', () => {
    const { meta } = newSong({ id: 'custom:1', chart, audio: new Blob([]), title: 'A', artist: '', generatorVersion: 1, createdAt: 5 });
    expect(renamedMeta(meta, '  Ёлка ')).toMatchObject({ title: 'Ёлка', titleKey: 'елка' });
    expect(renamedMeta(meta, '   ')).toBeNull();
  });
});

describe('newSong', () => {
  it('builds the meta from the chart and gives the chart the song id and names', () => {
    const audio = new Blob([new Uint8Array(10)]);
    const song = newSong({ id: 'custom:abc', chart, audio, title: 'Ёлка', artist: 'Хор', generatorVersion: 3, createdAt: 1000 });
    expect(song.meta).toEqual({
      id: 'custom:abc',
      title: 'Ёлка',
      artist: 'Хор',
      titleKey: 'елка',
      durationSec: 183.3,
      bpm: 128,
      stars: 4,
      notes: 3,
      generatorVersion: 3,
      createdAt: 1000,
      lastPlayedAt: null,
    });
    expect(song.chart).toMatchObject({ id: 'custom:abc', title: 'Ёлка', artist: 'Хор', bpm: 127.6 });
    expect(song.audio).toBe(audio);
  });

  it('refuses songs shorter than 30 s or longer than 12 min', () => {
    expect(songLengthProblem(29.9)).toBe('short');
    expect(songLengthProblem(NaN)).toBe('short');
    expect(songLengthProblem(30)).toBeNull();
    expect(songLengthProblem(720)).toBeNull();
    expect(songLengthProblem(720.1)).toBe('long');
  });
});

describe('records', () => {
  const run = (over: Partial<PlayResult>) =>
    bestOfRun(
      { score: 1000, accuracy: 0.9, rank: 'A', maxCombo: 50, fullCombo: false, stars: 2, crowns: 0, ...over } as PlayResult,
      '2026-09-25T10:00:00.000Z',
    );

  it('the first run is the record', () => {
    expect(mergeBest(undefined, run({}))).toEqual({ best: run({}), newRecord: true });
  });

  it('a higher score replaces the record; stars, crowns and full combo only grow', () => {
    const prev = run({ score: 1000, stars: 3, crowns: 1, fullCombo: true, rank: 'S' });
    const better = mergeBest(prev, run({ score: 2000, stars: 1, rank: 'B' }));
    expect(better.newRecord).toBe(true);
    expect(better.best).toMatchObject({ score: 2000, stars: 3, crowns: 1, fullCombo: true, rank: 'B' });
    const worse = mergeBest(prev, run({ score: 500, crowns: 2, rank: 'SS' }));
    expect(worse.newRecord).toBe(false);
    expect(worse.best).toMatchObject({ score: 1000, stars: 3, crowns: 2, rank: 'SS' });
    expect(mergeBest(prev, run({ score: 1000 })).newRecord).toBe(false);
  });
});
