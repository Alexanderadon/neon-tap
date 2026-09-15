import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AVATAR_IDS } from '@/shared/config/avatars';
import { createArtCache } from '../model/artCache';
import { AvatarArt } from './AvatarArt';
import { AvatarEmblem } from './AvatarEmblem';
import { avatarArtOf } from './artOf';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe('AvatarEmblem', () => {
  it('draws every avatar as a glossy sphere with its own glyph and no filter', () => {
    const seen = new Set<string>();
    for (const id of AVATAR_IDS) {
      const out = html(createElement(AvatarEmblem, { id }));
      expect(out.startsWith('<svg viewBox="0 0 64 64"')).toBe(true);
      expect(out).toContain('<radialGradient');
      expect(out).toContain('aria-hidden="true"');
      expect(out).not.toContain('filter');
      const glyph = out.slice(out.indexOf('<g '));
      expect(seen.has(glyph)).toBe(false);
      seen.add(glyph);
    }
  });

  it('gives every gradient a unique id so a grid of twelve does not share defs', () => {
    const out = html(createElement('div', null, ...AVATAR_IDS.map((id) => createElement(AvatarEmblem, { id, key: id }))));
    const ids = out.match(/ id="[^"]+"/g) ?? [];
    expect(ids.length).toBe(AVATAR_IDS.length);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('AvatarArt', () => {
  it('renders the file when the cache says it exists, the emblem otherwise (and while unknown)', async () => {
    const present = createArtCache(
      async () => true,
      (id) => `/avatars/${id}.webp`,
    );
    await present.probe('fox');
    expect(html(createElement(AvatarArt, { id: 'fox', cache: present }))).toMatch(/^<img src="\/avatars\/fox\.webp" alt=""/);
    const missing = createArtCache(async () => false);
    await missing.probe('fox');
    expect(html(createElement(AvatarArt, { id: 'fox', cache: missing }))).toContain('<svg');
    expect(html(createElement(AvatarArt, { id: 'cat', cache: missing }))).toContain('<svg');
  });

  it('avatarArtOf gives art for a known id only', () => {
    expect(avatarArtOf('')).toBeUndefined();
    expect(avatarArtOf(undefined)).toBeUndefined();
    expect(avatarArtOf('unicorn')).toBeUndefined();
    expect(avatarArtOf('owl')).toBeDefined();
  });
});
