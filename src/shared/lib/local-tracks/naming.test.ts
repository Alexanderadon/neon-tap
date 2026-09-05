import { describe, expect, it } from 'vitest';
import { extensionOf, isAudioFile, parseTrackName, slugify, stripExtension, transliterate, uniqueIds } from './naming';

describe('transliterate', () => {
  it('maps Russian letters, keeps Latin and punctuation', () => {
    expect(transliterate('Лебединое озеро')).toBe('Lebedinoe ozero');
    expect(transliterate('Noize MC — Жизнь без наркотиков')).toBe('Noize MC — Zhizn bez narkotikov');
    expect(transliterate('Ёлка, щука и объём')).toBe('Yolka, schuka i obyom');
    expect(transliterate('Цой — Хочу перемен')).toBe('Tsoy — Hochu peremen');
  });

  it('keeps the case of the first Latin letter for a capital Cyrillic letter', () => {
    expect(transliterate('Юля')).toBe('Yulya');
    expect(transliterate('ЩИ')).toBe('SchI');
  });
});

describe('slugify', () => {
  it('builds a lower-case Latin id joined by dashes', () => {
    expect(slugify('Noize MC - Лебединое озеро')).toBe('noize-mc-lebedinoe-ozero');
    expect(slugify('  Hello,  World!!  ')).toBe('hello-world');
    expect(slugify('Кино — Группа крови (1988)')).toBe('kino-gruppa-krovi-1988');
  });

  it('drops diacritics and falls back to "track" for an empty result', () => {
    expect(slugify('Café Déjà Vu')).toBe('cafe-deja-vu');
    expect(slugify('')).toBe('track');
    expect(slugify('---')).toBe('track');
    expect(slugify('日本')).toBe('track');
  });
});

describe('extensions', () => {
  it('detects supported audio files case-insensitively', () => {
    expect(extensionOf('song.MP3')).toBe('.mp3');
    expect(extensionOf('noext')).toBe('');
    expect(isAudioFile('a.flac')).toBe(true);
    expect(isAudioFile('a.m4a')).toBe(true);
    expect(isAudioFile('a.txt')).toBe(false);
    expect(isAudioFile('README.md')).toBe(false);
    expect(stripExtension('Artist - Title.ogg')).toBe('Artist - Title');
    expect(stripExtension('notes.txt')).toBe('notes.txt');
  });
});

describe('parseTrackName', () => {
  it('splits "Artist - Title" on a spaced dash (hyphen, en or em dash)', () => {
    expect(parseTrackName('Noize MC - Лебединое озеро.mp3')).toEqual({ id: 'noize-mc-lebedinoe-ozero', artist: 'Noize MC', title: 'Лебединое озеро' });
    expect(parseTrackName('Кино – Группа крови.flac')).toEqual({ id: 'kino-gruppa-krovi', artist: 'Кино', title: 'Группа крови' });
    expect(parseTrackName('Daft Punk — One More Time.wav')).toEqual({ id: 'daft-punk-one-more-time', artist: 'Daft Punk', title: 'One More Time' });
  });

  it('keeps extra dashes inside the title', () => {
    expect(parseTrackName('Artist - Title - Live.mp3')).toEqual({ id: 'artist-title-live', artist: 'Artist', title: 'Title - Live' });
  });

  it('uses the whole name as the title when there is no separator', () => {
    expect(parseTrackName('my-song.mp3')).toEqual({ id: 'my-song', artist: '', title: 'my-song' });
    expect(parseTrackName('Лебединое озеро.m4a')).toEqual({ id: 'lebedinoe-ozero', artist: '', title: 'Лебединое озеро' });
    expect(parseTrackName('Hello-World.mp3').artist).toBe('');
  });

  it('drops a leading track number and any directory part', () => {
    expect(parseTrackName('03 - Artist - Title.mp3')).toEqual({ id: 'artist-title', artist: 'Artist', title: 'Title' });
    expect(parseTrackName('03. Song.mp3')).toEqual({ id: 'song', artist: '', title: 'Song' });
    expect(parseTrackName('12 Song.mp3')).toEqual({ id: 'song', artist: '', title: 'Song' });
    expect(parseTrackName('C:\\music\\Artist - Title.mp3')).toEqual({ id: 'artist-title', artist: 'Artist', title: 'Title' });
    expect(parseTrackName('/tmp/Artist - Title.mp3').title).toBe('Title');
  });

  it('keeps a purely numeric name', () => {
    expect(parseTrackName('1999.mp3')).toEqual({ id: '1999', artist: '', title: '1999' });
  });
});

describe('uniqueIds', () => {
  it('suffixes repeats in order', () => {
    expect(uniqueIds(['a', 'b', 'a', 'a', 'c', 'b'])).toEqual(['a', 'b', 'a-2', 'a-3', 'c', 'b-2']);
  });
});
