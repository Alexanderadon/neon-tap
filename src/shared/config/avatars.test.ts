import { describe, expect, it } from 'vitest';
import { AVATAR_IDS, isAvatarId, sanitizeAvatar } from './avatars';

describe('avatar ids', () => {
  it('lists twelve distinct lowercase ids (they are file names under public/avatars)', () => {
    expect(AVATAR_IDS).toHaveLength(12);
    expect(new Set(AVATAR_IDS).size).toBe(12);
    for (const id of AVATAR_IDS) expect(id).toMatch(/^[a-z]+$/);
  });

  it('recognises known ids only', () => {
    expect(isAvatarId('cat')).toBe(true);
    expect(isAvatarId('Cat')).toBe(false);
    expect(isAvatarId('')).toBe(false);
    expect(isAvatarId(42)).toBe(false);
  });

  it('sanitises a saved choice to a known id or the letter avatar', () => {
    expect(sanitizeAvatar('dino')).toBe('dino');
    expect(sanitizeAvatar('unicorn')).toBe('');
    expect(sanitizeAvatar(undefined)).toBe('');
    expect(sanitizeAvatar(null)).toBe('');
  });
});
