import { describe, expect, it } from 'vitest';
import type { SongMeta } from '@/entities/custom-song';
import { testSong } from '@/entities/custom-song/model/testSongs';
import { matchesQuery, visibleSongs } from './filter';

const song = (title: string, over: { artist?: string; stars?: number; createdAt?: number; lastPlayedAt?: number } = {}): SongMeta => ({
  ...testSong(`custom:${title}`, { title, artist: over.artist, stars: over.stars, createdAt: over.createdAt }).meta,
  lastPlayedAt: over.lastPlayedAt ?? null,
});

const titles = (list: SongMeta[]) => list.map((s) => s.title);

describe('search', () => {
  it('ignores case and treats ё as е, both ways', () => {
    const hedgehog = song('Ёжик в тумане');
    const blackberry = song('Ежевика');
    expect(matchesQuery(hedgehog, 'еж')).toBe(true);
    expect(matchesQuery(hedgehog, 'ЁЖ')).toBe(true);
    expect(matchesQuery(blackberry, 'Ёж')).toBe(true);
    expect(matchesQuery(hedgehog, 'ТУМАН')).toBe(true);
    expect(matchesQuery(hedgehog, 'лиса')).toBe(false);
  });

  it('finds by the artist too; a blank query shows everything', () => {
    const s = song('Кукушка', { artist: 'Кино' });
    expect(matchesQuery(s, 'кино')).toBe(true);
    expect(matchesQuery(s, '   ')).toBe(true);
    expect(visibleSongs([s, song('Другая')], 'кИн', 'az').map((x) => x.title)).toEqual(['Кукушка']);
  });
});

describe('sort', () => {
  it('А–Я: Russian order with ё next to е, numbers by value, case ignored', () => {
    const list = [song('Трек 10'), song('жук'), song('Ёлка'), song('Трек 2'), song('Ежик'), song('азбука')];
    expect(titles(visibleSongs(list, '', 'az'))).toEqual(['азбука', 'Ежик', 'Ёлка', 'жук', 'Трек 2', 'Трек 10']);
  });

  it('Недавние: last played first, a never played song by the time it was added', () => {
    const list = [song('A', { createdAt: 1 }), song('B', { createdAt: 5 }), song('C', { createdAt: 2, lastPlayedAt: 10 })];
    expect(titles(visibleSongs(list, '', 'recent'))).toEqual(['C', 'B', 'A']);
  });

  it('Сложность: easy first, then by title', () => {
    const list = [song('Б', { stars: 5 }), song('В', { stars: 2 }), song('А', { stars: 5 })];
    expect(titles(visibleSongs(list, '', 'level'))).toEqual(['В', 'А', 'Б']);
  });

  it('leaves the input untouched', () => {
    const list = [song('Б'), song('А')];
    visibleSongs(list, '', 'az');
    expect(titles(list)).toEqual(['Б', 'А']);
  });
});
