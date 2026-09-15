import { describe, expect, it } from 'vitest';
import { AVATAR_IDS } from '@/shared/config/avatars';
import { AVATARS, avatarArtUrl, avatarMeta, avatarName } from './catalogue';

describe('avatar catalogue', () => {
  it('covers every id once, in the shared order (the picker is 4 × 3)', () => {
    expect(AVATARS.map((a) => a.id)).toEqual([...AVATAR_IDS]);
    expect(AVATARS).toHaveLength(12);
  });

  it('gives every avatar a distinct accent and a Russian name', () => {
    const accents = new Set(AVATARS.map((a) => a.accent));
    expect(accents.size).toBe(AVATARS.length);
    for (const a of AVATARS) {
      expect(a.accent).toMatch(/^#[0-9a-f]{6}$/);
      expect(a.under).toMatch(/^#[0-9a-f]{6}$/);
      expect(avatarName(a.id)).toMatch(/^[А-Яа-яЁё\s­-]+$/);
    }
    // Soft hyphens mark where the picker may break a long word; they are invisible otherwise.
    expect(avatarName('cat')).toBe('Кошка');
    expect(avatarName('astronaut').replace(/­/g, '')).toBe('Космонавт');
    expect(avatarMeta('dino').id).toBe('dino');
  });

  it('points at public/avatars/<id>.webp under the app base', () => {
    expect(avatarArtUrl('fox', '/')).toBe('/avatars/fox.webp');
    expect(avatarArtUrl('fox', '/neon-tap/')).toBe('/neon-tap/avatars/fox.webp');
    expect(avatarArtUrl('fox')).toMatch(/\/avatars\/fox\.webp$/);
  });
});
