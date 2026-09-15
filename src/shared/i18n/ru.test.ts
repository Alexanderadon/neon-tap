import { describe, expect, it } from 'vitest';
import { ru } from './ru';
import { common } from './parts/common';
import { menu } from './parts/menu';
import { result } from './parts/result';
import { shop } from './parts/shop';
import { onboard } from './parts/onboard';
import { game } from './parts/game';
import { offers } from './parts/offers';

const PARTS: Record<string, Record<string, unknown>> = { common, menu, result, shop, onboard, game, offers };

describe('ru dictionary parts', () => {
  it('have no key collisions (a later spread would silently override an earlier part)', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const [part, obj] of Object.entries(PARTS)) {
      for (const key of Object.keys(obj)) {
        const owner = seen.get(key);
        if (owner) clashes.push(`${key} (${owner} and ${part})`);
        else seen.set(key, part);
      }
    }
    expect(clashes).toEqual([]);
    expect(Object.keys(ru).length).toBe(seen.size);
  });

  it('keeps the shared keys the app already uses', () => {
    expect(ru.play).toBe('Играть');
    expect(ru.deckChapter).toBe('Глава {n}');
    expect(typeof ru.achievements).toBe('object');
  });
});
